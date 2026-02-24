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

function wrapPkcs1InPkcs8(pkcs1Der: ArrayBuffer): ArrayBuffer {
  const pkcs1Bytes = new Uint8Array(pkcs1Der);
  const oid = new Uint8Array([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00
  ]);
  const octetString = encodeAsn1Length(0x04, pkcs1Bytes.length, pkcs1Bytes);
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const seqContent = new Uint8Array(version.length + oid.length + octetString.length);
  seqContent.set(version, 0);
  seqContent.set(oid, version.length);
  seqContent.set(octetString, version.length + oid.length);
  return encodeAsn1Length(0x30, seqContent.length, seqContent).buffer;
}

function encodeAsn1Length(tag: number, contentLen: number, content: Uint8Array): Uint8Array {
  let lenBytes: Uint8Array;
  if (contentLen < 0x80) {
    lenBytes = new Uint8Array([contentLen]);
  } else if (contentLen < 0x100) {
    lenBytes = new Uint8Array([0x81, contentLen]);
  } else if (contentLen < 0x10000) {
    lenBytes = new Uint8Array([0x82, (contentLen >> 8) & 0xff, contentLen & 0xff]);
  } else {
    lenBytes = new Uint8Array([0x83, (contentLen >> 16) & 0xff, (contentLen >> 8) & 0xff, contentLen & 0xff]);
  }
  const result = new Uint8Array(1 + lenBytes.length + content.length);
  result[0] = tag;
  result.set(lenBytes, 1);
  result.set(content, 1 + lenBytes.length);
  return result;
}

async function signMessage(message: string, privateKeyPem: string): Promise<string> {
  let keyData = pemToArrayBuffer(privateKeyPem);

  if (privateKeyPem.includes("RSA PRIVATE KEY")) {
    keyData = wrapPkcs1InPkcs8(keyData);
  }

  try {
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
  } catch (_e) {
    const wrappedKeyData = wrapPkcs1InPkcs8(pemToArrayBuffer(privateKeyPem));
    const key = await crypto.subtle.importKey(
      "pkcs8",
      wrappedKeyData,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(message));
    return base64Encode(new Uint8Array(signature));
  }
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
        .update({ payment_status: "completed" })
        .eq("id", registration_id);

      const { data: registration } = await supabaseAdmin
        .from("registrations")
        .select("nome, cognome, email, payment_method")
        .eq("id", registration_id)
        .single();

      // Send confirmation email (fire-and-forget)
      if (registration) {
        try {
          const emailRes = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-confirmation-email`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                nome: registration.nome,
                cognome: registration.cognome,
                email: registration.email,
                payment_method: registration.payment_method,
                registration_id,
              }),
            }
          );
          if (!emailRes.ok) {
            const errText = await emailRes.text();
            console.error("Email send failed:", errText);
          }
        } catch (emailErr) {
          console.error("Email send error:", emailErr.message);
        }
      }

      return new Response(
        JSON.stringify({ status: "completed", registration }),
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
