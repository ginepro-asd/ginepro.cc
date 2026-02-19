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
  const lines = pem
    .replace(/-----BEGIN .*-----/, "")
    .replace(/-----END .*-----/, "")
    .replace(/\s/g, "");
  const binary = atob(lines);
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id, registration_id } = await req.json();

    if (!payment_id || !registration_id) {
      throw new Error("Missing payment_id or registration_id");
    }

    const keyId = Deno.env.get("SATISPAY_KEY_ID")!;
    const privateKey = Deno.env.get("SATISPAY_RSA_PRIVATE_KEY")!;

    // GET request has empty body
    const body = "";
    const path = `/g_business/v1/payments/${payment_id}`;
    const date = new Date().toUTCString();
    const host = "authservices.satispay.com";
    const digest = await createDigest(body);

    const message = `(request-target): get ${path}\nhost: ${host}\ndate: ${date}\ndigest: ${digest}`;
    const signature = await signMessage(message, privateKey);

    const authHeader = `Signature keyId="${keyId}", algorithm="rsa-sha256", headers="(request-target) host date digest", signature="${signature}"`;

    const res = await fetch(`${SATISPAY_API_URL}${path}`, {
      method: "GET",
      headers: {
        "Host": host,
        "Date": date,
        "Content-Type": "application/json",
        "Digest": digest,
        "Authorization": authHeader,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Satispay GET error:", res.status, errText);
      throw new Error(`Satispay error: ${res.status}`);
    }

    const payment = await res.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (payment.status === "ACCEPTED") {
      await supabaseAdmin
        .from("registrations")
        .update({ payment_status: "paid" })
        .eq("id", registration_id);

      const { data: registration } = await supabaseAdmin
        .from("registrations")
        .select("nome, cognome, email, payment_method")
        .eq("id", registration_id)
        .single();

      return new Response(
        JSON.stringify({ status: "paid", registration }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (payment.status === "CANCELED") {
      await supabaseAdmin
        .from("registrations")
        .update({ payment_status: "cancelled" })
        .eq("id", registration_id);

      return new Response(
        JSON.stringify({ status: "cancelled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Still PENDING
    return new Response(
      JSON.stringify({ status: "pending" }),
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
