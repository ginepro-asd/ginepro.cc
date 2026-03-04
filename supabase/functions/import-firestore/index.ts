import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Events to skip
const SKIP_EVENTS = ["cre2025", "cre25", "ice", "s12", "sig", "gob", "stb"];
// Events that are tesseramenti
const TESSERAMENTO_IDS = ["t25", "t26"];

// Generate slug from event name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Extract Firestore field value
function fv(val: any): any {
  if (!val) return null;
  if (val.stringValue !== undefined) return val.stringValue || null;
  if (val.integerValue !== undefined) return val.integerValue;
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.doubleValue !== undefined) return val.doubleValue;
  if (val.timestampValue !== undefined) return val.timestampValue;
  if (val.nullValue !== undefined) return null;
  return JSON.stringify(val);
}

// Detect if a string looks like an email
function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// Simple Italian CF calculation - we'll use the data we have
// For full calculation we need: nome, cognome, birth_date, birth_place, gender
// This is complex, so we only set CF if fiscalCode is already present in the data

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const textEncoder = new TextEncoder();
  const inputData = textEncoder.encode(`${header}.${payload}`);

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
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    inputData
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${header}.${payload}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok)
    throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();
    const adminPw = Deno.env.get("ADMIN_PASSWORD");
    if (!adminPw || password !== adminPw) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const saJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!saJson) throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
    const sa = JSON.parse(saJson);
    const projectId = sa.project_id;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const accessToken = await getAccessToken(sa);
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    // 1. List all events from Firestore
    const eventsRes = await fetch(`${baseUrl}/events?pageSize=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const eventsData = await eventsRes.json();

    if (!eventsData.documents) {
      return new Response(
        JSON.stringify({ message: "No events found in Firestore" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stats = {
      eventsCreated: 0,
      participantsCreated: 0,
      participantsUpdated: 0,
      registrationsCreated: 0,
      skippedEvents: [] as string[],
      importedEvents: [] as string[],
      errors: [] as string[],
    };

    // Common fields that map to participant/registration columns
    const COMMON_FIELD_MAP: Record<string, string> = {
      name: "nome",
      first: "nome",
      last: "cognome",
      lastName: "cognome",
      mail: "email",
      birthday: "birth_date",
      birthplace: "birth_place",
      birthCity: "birth_place",
      fiscalCode: "codice_fiscale",
      gender: "gender",
    };

    // Fields to extract but store in custom_data
    const CUSTOM_KNOWN_FIELDS = [
      "team",
      "photo",
      "signature",
      "type",
      "distance",
      "food",
      "bib",
      "address",
      "city",
      "cap",
      "province",
      "nation",
      "emergencyContact",
      "emergencyPhone",
      "medicalCertificate",
      "tShirtSize",
      "notes",
    ];

    // Participant cache by email for deduplication
    const participantCache = new Map<string, string>(); // email -> participant_id

    // Pre-load existing participants
    const { data: existingParticipants } = await sb
      .from("participants")
      .select("id, email");
    if (existingParticipants) {
      for (const p of existingParticipants) {
        participantCache.set(p.email.toLowerCase(), p.id);
      }
    }

    for (const doc of eventsData.documents) {
      const firestoreEventId = doc.name.split("/").pop()!;

      // Skip excluded events
      if (
        SKIP_EVENTS.some(
          (s) =>
            firestoreEventId.toLowerCase() === s.toLowerCase() ||
            firestoreEventId.toLowerCase().includes(s.toLowerCase())
        )
      ) {
        stats.skippedEvents.push(firestoreEventId);
        continue;
      }

      // Derive event name from Firestore doc fields or ID
      const eventFields = doc.fields || {};
      const eventName =
        fv(eventFields.name) ||
        fv(eventFields.title) ||
        fv(eventFields.nome) ||
        firestoreEventId;
      const isTesseramento = TESSERAMENTO_IDS.includes(
        firestoreEventId.toLowerCase()
      );
      const slug = generateSlug(eventName);

      // Create event in Supabase
      const { data: createdEvent, error: eventError } = await sb
        .from("events")
        .upsert(
          {
            nome: eventName,
            slug,
            prezzo: 0,
            attivo: false, // imported events are inactive by default
            is_tesseramento: isTesseramento,
            descrizione: `Importato da Firestore (${firestoreEventId})`,
          },
          { onConflict: "slug" }
        )
        .select("id, slug")
        .single();

      if (eventError) {
        stats.errors.push(
          `Event ${firestoreEventId}: ${eventError.message}`
        );
        continue;
      }

      stats.eventsCreated++;
      stats.importedEvents.push(`${eventName} (${slug})`);

      // 2. Fetch ALL entries for this event (paginate)
      let nextPageToken: string | null = null;
      let allEntries: any[] = [];

      do {
        const url = `${baseUrl}/events/${firestoreEventId}/entries?pageSize=300${
          nextPageToken ? `&pageToken=${nextPageToken}` : ""
        }`;
        const entriesRes = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const entriesData = await entriesRes.json();
        if (entriesData.documents) {
          allEntries = allEntries.concat(entriesData.documents);
        }
        nextPageToken = entriesData.nextPageToken || null;
      } while (nextPageToken);

      // 3. Process each entry
      for (const entry of allEntries) {
        try {
          const fields = entry.fields || {};
          const raw: Record<string, any> = {};
          for (const [k, v] of Object.entries(fields)) {
            raw[k] = fv(v);
          }

          // Extract standard fields
          const nome = raw.name || raw.first || raw.nome || "";
          const cognome = raw.last || raw.lastName || raw.cognome || "";
          let email = raw.mail || raw.email || "";
          let telefono = raw.contact || raw.telefono || raw.phone || "";

          // Handle contact field: could be email or phone
          if (!email && telefono && isEmail(telefono)) {
            email = telefono;
            telefono = "";
          }
          if (raw.contact) {
            if (isEmail(raw.contact)) {
              if (!email) email = raw.contact;
            } else {
              if (!telefono) telefono = raw.contact;
            }
          }

          if (!nome && !cognome) continue; // Skip empty entries
          if (!email) email = `noemail_${Date.now()}_${Math.random().toString(36).slice(2)}@placeholder.local`;

          const emailLower = email.toLowerCase();
          const birthDate = raw.birthday || raw.birth_date || null;
          const birthPlace =
            raw.birthplace || raw.birthCity || raw.birth_place || null;
          const codiceFiscale = raw.fiscalCode || raw.codice_fiscale || null;
          const gender = raw.gender || null;

          // Upsert participant
          let participantId = participantCache.get(emailLower);
          if (!participantId) {
            const { data: newP, error: pErr } = await sb
              .from("participants")
              .insert({
                nome,
                cognome,
                email: emailLower,
                telefono: telefono || "",
                birth_date: birthDate,
                birth_place: birthPlace,
                codice_fiscale: codiceFiscale,
                identification_type: codiceFiscale ? "cf" : "birth",
              })
              .select("id")
              .single();

            if (pErr) {
              // Might be duplicate, try to fetch
              const { data: existP } = await sb
                .from("participants")
                .select("id")
                .eq("email", emailLower)
                .single();
              if (existP) {
                participantId = existP.id;
                participantCache.set(emailLower, participantId);
                stats.participantsUpdated++;
              } else {
                stats.errors.push(`Participant ${emailLower}: ${pErr.message}`);
                continue;
              }
            } else {
              participantId = newP.id;
              participantCache.set(emailLower, participantId);
              stats.participantsCreated++;
            }
          } else {
            stats.participantsUpdated++;
          }

          // Build custom_data with all non-standard fields
          const customData: Record<string, any> = {};
          const standardKeys = new Set([
            "name",
            "first",
            "last",
            "lastName",
            "nome",
            "cognome",
            "mail",
            "email",
            "contact",
            "telefono",
            "phone",
            "birthday",
            "birth_date",
            "birthplace",
            "birthCity",
            "birth_place",
            "fiscalCode",
            "codice_fiscale",
          ]);

          for (const [k, v] of Object.entries(raw)) {
            if (!standardKeys.has(k) && v !== null && v !== "") {
              customData[k] = v;
            }
          }

          // Create registration
          const { error: regErr } = await sb.from("registrations").insert({
            event_id: createdEvent.id,
            participant_id: participantId,
            nome,
            cognome,
            email: emailLower,
            telefono: telefono || "",
            birth_date: birthDate,
            birth_place: birthPlace,
            codice_fiscale: codiceFiscale,
            identification_type: codiceFiscale ? "cf" : "birth",
            payment_method: "imported",
            payment_status: "completed",
            custom_data: Object.keys(customData).length > 0 ? customData : null,
          });

          if (regErr) {
            stats.errors.push(`Registration ${emailLower}@${slug}: ${regErr.message}`);
          } else {
            stats.registrationsCreated++;
          }
        } catch (entryErr: any) {
          stats.errors.push(`Entry parse error: ${entryErr.message}`);
        }
      }
    }

    return new Response(JSON.stringify(stats, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
