import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));

  const textEncoder = new TextEncoder();
  const inputData = textEncoder.encode(`${header}.${payload}`);

  // Import the RSA private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, inputData);
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${header}.${payload}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const saJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!saJson) throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
    const sa = JSON.parse(saJson);
    const projectId = sa.project_id;

    const accessToken = await getAccessToken(sa);
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    // List events collection
    const eventsRes = await fetch(`${baseUrl}/events?pageSize=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const eventsData = await eventsRes.json();

    if (!eventsData.documents) {
      return new Response(JSON.stringify({ events: [], message: "No events found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const doc of eventsData.documents) {
      const eventId = doc.name.split("/").pop()!;

      // Skip excluded events
      if (eventId.toLowerCase().includes("cre2025") || eventId.toLowerCase().includes("cre25")) {
        continue;
      }

      // Get sample entries (first 3)
      const entriesRes = await fetch(`${baseUrl}/events/${eventId}/entries?pageSize=3`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const entriesData = await entriesRes.json();

      const sampleFields: string[][] = [];
      if (entriesData.documents) {
        for (const entry of entriesData.documents) {
          const fields = Object.keys(entry.fields || {});
          sampleFields.push(fields);
        }
      }

      // Get unique fields across samples
      const allFields = [...new Set(sampleFields.flat())].sort();

      results.push({
        eventId,
        entryCount: entriesData.documents?.length ?? 0,
        note: entriesData.documents?.length === 3 ? "3+ entries (showing first 3)" : undefined,
        fields: allFields,
        sampleData: entriesData.documents?.slice(0, 1).map((d: any) => {
          const simplified: any = {};
          for (const [k, v] of Object.entries(d.fields || {})) {
            const val = v as any;
            simplified[k] = val.stringValue ?? val.integerValue ?? val.booleanValue ?? val.doubleValue ?? val.timestampValue ?? JSON.stringify(val);
          }
          return simplified;
        }),
      });
    }

    return new Response(JSON.stringify({ events: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
