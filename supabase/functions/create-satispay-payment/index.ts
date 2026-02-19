import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SATISPAY_API_URL = "https://authservices.satispay.com";

async function createDigest(body: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(body);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return `SHA-256=${base64Encode(new Uint8Array(hash))}`;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  // Normalize: handle literal \n strings, escaped newlines, and missing line breaks
  const normalized = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s/g, "");
  
  if (!normalized || normalized.length === 0) {
    throw new Error("RSA private key is empty or malformed");
  }

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function signMessage(message: string, privateKeyPem: string): Promise<string> {
  const keyData = pemToArrayBuffer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(message));
  return base64Encode(new Uint8Array(signature));
}

async function satispayRequest(
  method: string,
  path: string,
  body: string,
  keyId: string,
  privateKey: string
): Promise<Response> {
  const date = new Date().toUTCString();
  const host = "authservices.satispay.com";
  const digest = await createDigest(body);

  const message = `(request-target): ${method.toLowerCase()} ${path}\nhost: ${host}\ndate: ${date}\ndigest: ${digest}`;
  const signature = await signMessage(message, privateKey);

  const authHeader = `Signature keyId="${keyId}", algorithm="rsa-sha256", headers="(request-target) host date digest", signature="${signature}"`;

  return fetch(`${SATISPAY_API_URL}${path}`, {
    method: method.toUpperCase(),
    headers: {
      "Host": host,
      "Date": date,
      "Content-Type": "application/json",
      "Digest": digest,
      "Authorization": authHeader,
    },
    body,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      nome,
      cognome,
      email,
      telefono,
      identificationType,
      birthDate,
      birthPlace,
      codiceFiscale,
    } = await req.json();

    if (!nome || !cognome || !email || !telefono || !identificationType) {
      throw new Error("Campi obbligatori mancanti");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Save registration
    const { data: registration, error: dbError } = await supabaseAdmin
      .from("registrations")
      .insert({
        nome,
        cognome,
        email,
        telefono,
        identification_type: identificationType,
        birth_date: birthDate || null,
        birth_place: birthPlace || null,
        codice_fiscale: codiceFiscale || null,
        payment_method: "satispay",
        payment_status: "pending",
      })
      .select("id")
      .single();

    if (dbError) throw new Error(`Database error: ${dbError.message}`);

    // Create Satispay payment
    const keyId = Deno.env.get("SATISPAY_KEY_ID")!;
    const privateKey = Deno.env.get("SATISPAY_RSA_PRIVATE_KEY")!;

    const paymentBody = JSON.stringify({
      flow: "MATCH_CODE",
      amount_unit: 1499,
      currency: "EUR",
      external_code: registration.id,
      metadata: {
        registration_id: registration.id,
      },
    });

    const res = await satispayRequest(
      "POST",
      "/g_business/v1/payments",
      paymentBody,
      keyId,
      privateKey
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Satispay API error:", res.status, errText);
      throw new Error(`Satispay error: ${res.status}`);
    }

    const payment = await res.json();

    // Store the Satispay payment ID
    await supabaseAdmin
      .from("registrations")
      .update({ payment_id: payment.id })
      .eq("id", registration.id);

    return new Response(
      JSON.stringify({
        payment_id: payment.id,
        registration_id: registration.id,
        redirect_url: payment.redirect_url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
