import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function fv(val: any): any {
  if (!val) return null;
  if (val.stringValue !== undefined) return val.stringValue || null;
  if (val.integerValue !== undefined) return val.integerValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.arrayValue !== undefined) {
    const values = val.arrayValue?.values;
    if (values && Array.isArray(values)) {
      return values.map((v: any) => fv(v)).filter(Boolean);
    }
    return null;
  }
  if (val.nullValue !== undefined) return null;
  return JSON.stringify(val);
}

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

  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
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

function parseCertificateUrl(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    if (raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.arrayValue?.values) {
          for (const v of parsed.arrayValue.values) {
            if (v.stringValue) return v.stringValue;
          }
        }
      } catch { /* ignore */ }
    }
    if (raw.startsWith("http")) return raw;
    return null;
  }
  if (Array.isArray(raw)) {
    return raw.find((v: string) => typeof v === "string" && v.startsWith("http")) || null;
  }
  return null;
}

/** Use Lovable AI to look up CAP for an Italian city + province */
async function lookupCAP(city: string, province: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "user",
            content: `Qual è il CAP (codice di avviamento postale) principale del comune di "${city}" in provincia di "${province}" in Italia? Rispondi SOLO con le 5 cifre del CAP, nient'altro. Se non lo sai rispondi "null".`,
          },
        ],
        max_tokens: 20,
      }),
    });
    const data = await res.json();
    const answer = (data.choices?.[0]?.message?.content || "").trim();
    // Validate it's a 5-digit number
    if (/^\d{5}$/.test(answer)) return answer;
    return null;
  } catch {
    return null;
  }
}

/** Use Lovable AI vision to read certificate expiry date from image */
async function readCertificateExpiry(imageUrl: string, apiKey: string): Promise<string | null> {
  try {
    // Download image and convert to base64
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    
    // Convert to base64
    let base64 = "";
    const chunk = 8192;
    for (let i = 0; i < imgBytes.length; i += chunk) {
      base64 += String.fromCharCode(...imgBytes.slice(i, i + chunk));
    }
    base64 = btoa(base64);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Questa è un'immagine di un certificato medico sportivo italiano. Trova la data di scadenza del certificato. Rispondi SOLO con la data in formato YYYY-MM-DD (es: 2026-12-31). Se non riesci a trovarla rispondi "null".`,
              },
              {
                type: "image_url",
                image_url: { url: `data:${contentType};base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 20,
      }),
    });
    const data = await res.json();
    const answer = (data.choices?.[0]?.message?.content || "").trim();
    // Validate date format
    if (/^\d{4}-\d{2}-\d{2}$/.test(answer)) return answer;
    return null;
  } catch (e) {
    console.error("Certificate reading error:", e.message);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();

    const adminPw = Deno.env.get("ADMIN_PASSWORD");
    if (!password || password !== adminPw) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const saJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!saJson) throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
    const sa = JSON.parse(saJson);
    const projectId = sa.project_id;
    const accessToken = await getAccessToken(sa);
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch ALL t26 entries
    let allEntries: any[] = [];
    let nextPageToken: string | null = null;
    do {
      const url = `${baseUrl}/events/t26/entries?pageSize=300${nextPageToken ? `&pageToken=${nextPageToken}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await res.json();
      if (data.documents) allEntries = allEntries.concat(data.documents);
      nextPageToken = data.nextPageToken || null;
    } while (nextPageToken);

    console.log(`Found ${allEntries.length} entries in t26`);

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const capCache: Record<string, string | null> = {};

    for (const entry of allEntries) {
      try {
        const fields = entry.fields || {};
        const raw: Record<string, any> = {};
        for (const [k, v] of Object.entries(fields)) {
          raw[k] = fv(v);
        }

        const email = (raw.mail || raw.email || "").toLowerCase().trim();
        if (!email || email.includes("placeholder.local")) {
          skipped++;
          continue;
        }

        // Find participant by email
        const { data: participant } = await supabase
          .from("participants")
          .select("id, fidal_data")
          .eq("email", email)
          .single();

        if (!participant) {
          skipped++;
          continue;
        }

        // Extract residence fields
        const address = raw.address || null;
        const city = raw.city || null;
        const state = raw.state || null;
        const certificateUrlRaw = raw.certificateUrl;
        const certificateUrl = parseCertificateUrl(certificateUrlRaw);
        const type = raw.type || null;
        const gender = raw.gender || null;

        // Build fidal_data update
        const existingFidal = (participant.fidal_data as Record<string, any>) || {};
        const fidalUpdate: Record<string, any> = { ...existingFidal };

        if (address) fidalUpdate.indirizzo = address;
        if (city) fidalUpdate.citta = city;
        if (state) fidalUpdate.provincia = state;
        if (certificateUrl) fidalUpdate.certificateUrl = certificateUrl;
        if (type) fidalUpdate.tipo_tesseramento = type;
        if (gender) {
          const g = String(gender).toLowerCase();
          if (g === "m" || g === "maschio" || g === "male") fidalUpdate.sesso = "M";
          else if (g === "f" || g === "femmina" || g === "female") fidalUpdate.sesso = "F";
        }

        // Auto-calculate CAP from city + province using AI
        if (city && state && !existingFidal.cap) {
          const cacheKey = `${city.toLowerCase()}_${state.toLowerCase()}`;
          if (cacheKey in capCache) {
            if (capCache[cacheKey]) fidalUpdate.cap = capCache[cacheKey];
          } else {
            const cap = await lookupCAP(city, state, lovableApiKey);
            capCache[cacheKey] = cap;
            if (cap) {
              fidalUpdate.cap = cap;
              console.log(`CAP for ${city} (${state}): ${cap}`);
            }
          }
        }

        // Read certificate expiry date from image using AI vision
        if (certificateUrl && !existingFidal.scad_cert) {
          console.log(`Reading certificate for ${email}...`);
          const expiryDate = await readCertificateExpiry(certificateUrl, lovableApiKey);
          if (expiryDate) {
            fidalUpdate.scad_cert = expiryDate;
            console.log(`Certificate expiry for ${email}: ${expiryDate}`);
          } else {
            console.log(`Could not read certificate expiry for ${email}`);
          }
        }

        // Update participant
        const { error: updateErr } = await supabase
          .from("participants")
          .update({ fidal_data: fidalUpdate })
          .eq("id", participant.id);

        if (updateErr) {
          errors.push(`${email}: ${updateErr.message}`);
        } else {
          updated++;
        }
      } catch (e) {
        errors.push(`Entry error: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        total_entries: allEntries.length,
        updated,
        skipped,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
