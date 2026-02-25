import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SATISPAY_HOST = "authservices.satispay.com";
const SATISPAY_BASE = `https://${SATISPAY_HOST}/g_business/v1`;

// ── Crypto helpers ──────────────────────────────────────────────────────

async function sha256Digest(body: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return `SHA-256=${base64Encode(new Uint8Array(hash))}`;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s/g, "");
  if (!b64) throw new Error("RSA private key is empty or malformed");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function encodeAsn1Length(tag: number, content: Uint8Array): Uint8Array {
  const len = content.length;
  let lenBytes: Uint8Array;
  if (len < 0x80) lenBytes = new Uint8Array([len]);
  else if (len < 0x100) lenBytes = new Uint8Array([0x81, len]);
  else if (len < 0x10000) lenBytes = new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
  else lenBytes = new Uint8Array([0x83, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  const result = new Uint8Array(1 + lenBytes.length + content.length);
  result[0] = tag;
  result.set(lenBytes, 1);
  result.set(content, 1 + lenBytes.length);
  return result;
}

function wrapPkcs1InPkcs8(pkcs1Der: ArrayBuffer): ArrayBuffer {
  const pkcs1 = new Uint8Array(pkcs1Der);
  const oid = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86,
    0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
  ]);
  const octet = encodeAsn1Length(0x04, pkcs1);
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const seqContent = new Uint8Array(version.length + oid.length + octet.length);
  seqContent.set(version, 0);
  seqContent.set(oid, version.length);
  seqContent.set(octet, version.length + oid.length);
  return encodeAsn1Length(0x30, seqContent).buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  let keyData = pemToArrayBuffer(pem);

  // Try PKCS#8 first, fall back to wrapping PKCS#1
  try {
    return await crypto.subtle.importKey(
      "pkcs8", keyData,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false, ["sign"],
    );
  } catch {
    return await crypto.subtle.importKey(
      "pkcs8", wrapPkcs1InPkcs8(pemToArrayBuffer(pem)),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false, ["sign"],
    );
  }
}

async function sign(message: string, pem: string): Promise<string> {
  const key = await importPrivateKey(pem);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(message),
  );
  return base64Encode(new Uint8Array(sig));
}

// ── Satispay HTTP request builder (matches the working repo exactly) ────

async function satispayFetch(
  method: "GET" | "POST",
  path: string,
  body: string,
  keyId: string,
  privateKey: string,
): Promise<Response> {
  const date = new Date().toUTCString();
  const digest = await sha256Digest(body);

  // Signature string – must match exactly what Satispay expects
  const sigString = `(request-target): ${method.toLowerCase()} ${path}\nhost: ${SATISPAY_HOST}\ndate: ${date}\ndigest: ${digest}`;
  const signature = await sign(sigString, privateKey);

  const authHeader = `Signature keyId="${keyId}", algorithm="rsa-sha256", headers="(request-target) host date digest", signature="${signature}"`;

  const headers: Record<string, string> = {
    "Host": SATISPAY_HOST,
    "Date": date,
    "Digest": digest,
    "Authorization": authHeader,
    "Accept": "application/json",
  };

  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  return fetch(`https://${SATISPAY_HOST}${path}`, {
    method,
    headers,
    ...(method === "POST" ? { body } : {}),
  });
}

// ── Step 1: Look up consumer_uid by phone number ────────────────────────

async function getConsumerUid(
  phone: string,
  keyId: string,
  privateKey: string,
): Promise<string> {
  const path = `/g_business/v1/consumers/${encodeURIComponent(phone)}`;
  const res = await satispayFetch("GET", path, "", keyId, privateKey);

  if (!res.ok) {
    const errText = await res.text();
    console.error("Consumer lookup error:", res.status, errText);
    throw new Error(`Consumer lookup failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  console.log("Consumer found:", data.id);
  return data.id;
}

// ── Main handler ────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      nome, cognome, email, telefono,
      identificationType, birthDate, birthPlace, codiceFiscale,
    } = await req.json();

    if (!nome || !cognome || !email || !telefono || !identificationType) {
      throw new Error("Campi obbligatori mancanti");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Save registration
    const { data: registration, error: dbError } = await supabaseAdmin
      .from("registrations")
      .insert({
        nome, cognome, email, telefono,
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

    const keyId = Deno.env.get("SATISPAY_KEY_ID")!;
    const privateKey = Deno.env.get("SATISPAY_RSA_PRIVATE_KEY")!;

    // Debug: verify credentials are loaded
    console.log("Key ID:", keyId);
    console.log("Private key starts with:", privateKey?.substring(0, 40));
    console.log("Private key length:", privateKey?.length);

    // Step 1: Look up consumer by phone number (like the working repo)
    console.log("Looking up consumer for phone:", telefono);
    const consumerUid = await getConsumerUid(telefono, keyId, privateKey);

    // Step 2: Create MATCH_USER payment with consumer_uid
    const paymentBody = JSON.stringify({
      flow: "MATCH_USER",
      amount_unit: 100,
      currency: "EUR",
      consumer_uid: consumerUid,
      external_code: registration.id,
      callback_url: `https://tredoziotrail.lovable.app/conferma?registration_id=${registration.id}&provider=satispay`,
      metadata: {
        registration_id: registration.id,
      },
    });

    console.log("Creating MATCH_USER payment:", paymentBody);

    const res = await satispayFetch(
      "POST",
      "/g_business/v1/payments",
      paymentBody,
      keyId,
      privateKey,
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Satispay API error:", res.status, errText);
      throw new Error(`Satispay error: ${res.status} - ${errText}`);
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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
