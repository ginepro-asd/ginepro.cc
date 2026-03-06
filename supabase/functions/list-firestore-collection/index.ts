import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  }));
  const inputData = new TextEncoder().encode(`${header}.${payload}`);
  const pemContents = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, inputData);
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

function simplify(fields: any): any {
  const result: any = {};
  for (const [k, v] of Object.entries(fields || {})) {
    const val = v as any;
    result[k] = val.stringValue ?? val.integerValue ?? val.booleanValue ?? val.doubleValue ?? val.timestampValue ?? JSON.stringify(val);
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { collection } = await req.json();
    if (!collection) throw new Error("collection required");
    
    const sa = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!);
    const accessToken = await getAccessToken(sa);
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
    
    let allDocs: any[] = [];
    let pageToken = "";
    do {
      const url = `${baseUrl}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      if (data.documents) {
        allDocs = allDocs.concat(data.documents.map((d: any) => ({
          id: d.name.split("/").pop(),
          ...simplify(d.fields),
        })));
      }
      pageToken = data.nextPageToken || "";
    } while (pageToken);
    
    return new Response(JSON.stringify({ count: allDocs.length, documents: allDocs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
