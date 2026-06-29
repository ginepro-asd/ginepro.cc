import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isValidAdminPassword } from "../_shared/admin-password.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SKIP_EVENTS = ["cre2025", "cre25", "ice", "s12", "sig", "gob", "stb"];
const TESSERAMENTO_IDS = ["t25", "t26"];

const FIDAL_KEYS = new Set([
  "address", "city", "state", "certificateUrl", "type", "gender",
  "cap", "nazione", "nazionalita", "category",
]);

const STANDARD_KEYS = new Set([
  "name", "first", "last", "lastName", "nome", "cognome",
  "mail", "email", "contact", "telefono", "phone",
  "birthday", "birth_date", "birthplace", "birthCity", "birth_place",
  "fiscalCode", "codice_fiscale",
  // FIDAL keys are handled separately
  ...FIDAL_KEYS,
]);

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

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
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

function initcap(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

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

async function listFirestoreEvents(accessToken: string, baseUrl: string) {
  const eventsRes = await fetch(`${baseUrl}/events?pageSize=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const eventsData = await eventsRes.json();
  if (!eventsData.documents) return [];

  const promises = eventsData.documents.map(async (doc: any) => {
    const eventId = doc.name.split("/").pop()!;
    if (SKIP_EVENTS.some((s) => eventId.toLowerCase() === s.toLowerCase())) return null;

    const fields = doc.fields || {};
    const name = fv(fields.name) || fv(fields.title) || fv(fields.nome) || eventId;

    return {
      firestore_id: eventId,
      name,
      is_tesseramento: TESSERAMENTO_IDS.includes(eventId.toLowerCase()),
    };
  });

  const settled = await Promise.all(promises);
  return settled.filter(Boolean);
}

/** Extract FIDAL-related data from raw Firestore entry */
function extractFidalData(raw: Record<string, any>): Record<string, any> {
  const fidal: Record<string, any> = {};

  if (raw.address) fidal.indirizzo = raw.address;
  if (raw.city) fidal.citta = raw.city;
  if (raw.state) fidal.provincia = raw.state;
  if (raw.cap) fidal.cap = raw.cap;
  if (raw.nazione) fidal.nazione = raw.nazione;
  if (raw.nazionalita) fidal.nazionalita = raw.nazionalita;
  if (raw.category) fidal.categoria = raw.category;
  if (raw.type) fidal.tipo_tesseramento = raw.type;

  const certificateUrl = parseCertificateUrl(raw.certificateUrl);
  if (certificateUrl) fidal.certificateUrl = certificateUrl;

  if (raw.gender) {
    const g = String(raw.gender).toLowerCase();
    if (g === "m" || g === "maschio" || g === "male") fidal.sesso = "M";
    else if (g === "f" || g === "femmina" || g === "female") fidal.sesso = "F";
  }

  return Object.keys(fidal).length > 0 ? fidal : {};
}

async function importSingleEvent(
  firestoreEventId: string,
  accessToken: string,
  baseUrl: string,
  sb: any
) {
  const stats = {
    participantsCreated: 0,
    participantsUpdated: 0,
    registrationsCreated: 0,
    registrationsSkipped: 0,
    duplicatesRemoved: 0,
    errors: [] as string[],
  };

  // Fetch event doc
  const eventDocRes = await fetch(`${baseUrl}/events/${firestoreEventId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const eventDoc = await eventDocRes.json();
  if (eventDoc.error) throw new Error(`Event not found: ${firestoreEventId}`);

  const eventFields = eventDoc.fields || {};
  const eventName = fv(eventFields.name) || fv(eventFields.title) || fv(eventFields.nome) || firestoreEventId;
  const isTesseramento = TESSERAMENTO_IDS.includes(firestoreEventId.toLowerCase());
  const slug = generateSlug(eventName);

  // Upsert event
  const { data: createdEvent, error: eventError } = await sb
    .from("events")
    .upsert(
      {
        nome: eventName,
        slug,
        prezzo: 0,
        attivo: false,
        is_tesseramento: isTesseramento,
        descrizione: `Importato da Firestore (${firestoreEventId})`,
      },
      { onConflict: "slug" }
    )
    .select("id, slug")
    .single();

  if (eventError) throw new Error(`Event upsert failed: ${eventError.message}`);

  // Pre-load existing participants (email -> {id, fidal_data})
  const participantCache = new Map<string, { id: string; fidal_data: any }>();
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data: batch } = await sb
      .from("participants")
      .select("id, email, fidal_data")
      .range(offset, offset + pageSize - 1);
    if (!batch || batch.length === 0) break;
    for (const p of batch) {
      participantCache.set(p.email.toLowerCase(), { id: p.id, fidal_data: p.fidal_data });
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  // Pre-load existing registrations for this event (participant_id set)
  const existingRegs = new Set<string>();
  offset = 0;
  while (true) {
    const { data: batch } = await sb
      .from("registrations")
      .select("participant_id")
      .eq("event_id", createdEvent.id)
      .range(offset, offset + pageSize - 1);
    if (!batch || batch.length === 0) break;
    for (const r of batch) {
      if (r.participant_id) existingRegs.add(r.participant_id);
    }
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  // Fetch all entries with pagination
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

  // Deduplicate entries by email within this import batch
  const seenEmails = new Map<string, any>(); // email -> latest raw entry
  const parsedEntries: Array<{
    nome: string; cognome: string; email: string; telefono: string;
    birthDate: string | null; birthPlace: string | null; codiceFiscale: string | null;
    fidalData: Record<string, any>; customData: Record<string, any>;
  }> = [];

  for (const entry of allEntries) {
    try {
      const fields = entry.fields || {};
      const raw: Record<string, any> = {};
      for (const [k, v] of Object.entries(fields)) {
        raw[k] = fv(v);
      }

      let nome = raw.name || raw.first || raw.nome || "";
      let cognome = raw.last || raw.lastName || raw.cognome || "";
      let email = raw.mail || raw.email || "";
      let telefono = raw.contact || raw.telefono || raw.phone || "";

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

      if (!nome && !cognome) continue;
      if (!email) email = `noemail_${Date.now()}_${Math.random().toString(36).slice(2)}@placeholder.local`;

      const emailLower = email.toLowerCase().trim();
      nome = initcap(nome.trim());
      cognome = initcap(cognome.trim());

      const birthDate = raw.birthday || raw.birth_date || null;
      const birthPlace = raw.birthplace || raw.birthCity || raw.birth_place || null;
      const codiceFiscale = raw.fiscalCode || raw.codice_fiscale || null;
      const fidalData = extractFidalData(raw);

      const customData: Record<string, any> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (!STANDARD_KEYS.has(k) && v !== null && v !== "") {
          customData[k] = v;
        }
      }

      // Deduplicate: keep last occurrence per email (latest data wins)
      if (seenEmails.has(emailLower)) {
        stats.duplicatesRemoved++;
      }
      seenEmails.set(emailLower, {
        nome, cognome, email: emailLower, telefono: telefono || "",
        birthDate, birthPlace, codiceFiscale, fidalData, customData,
      });
    } catch (entryErr: any) {
      stats.errors.push(`Entry parse error: ${entryErr.message}`);
    }
  }

  // Process deduplicated entries
  for (const [emailLower, parsed] of seenEmails) {
    try {
      const { nome, cognome, telefono, birthDate, birthPlace, codiceFiscale, fidalData, customData } = parsed;

      let cached = participantCache.get(emailLower);
      if (!cached) {
        // Create new participant
        const { data: newP, error: pErr } = await sb
          .from("participants")
          .insert({
            nome, cognome, email: emailLower, telefono,
            birth_date: birthDate, birth_place: birthPlace,
            codice_fiscale: codiceFiscale,
            identification_type: codiceFiscale ? "cf" : "birth",
            fidal_data: Object.keys(fidalData).length > 0 ? fidalData : {},
          })
          .select("id")
          .single();

        if (pErr) {
          // Race condition: try to fetch existing
          const { data: existP } = await sb
            .from("participants")
            .select("id, fidal_data")
            .eq("email", emailLower)
            .single();
          if (existP) {
            cached = { id: existP.id, fidal_data: existP.fidal_data };
            participantCache.set(emailLower, cached);
            stats.participantsUpdated++;
          } else {
            stats.errors.push(`Participant ${emailLower}: ${pErr.message}`);
            continue;
          }
        } else {
          cached = { id: newP.id, fidal_data: fidalData };
          participantCache.set(emailLower, cached);
          stats.participantsCreated++;
        }
      } else {
        // Update existing participant with new data, merge fidal_data
        const existingFidal = (cached.fidal_data as Record<string, any>) || {};
        const mergedFidal = { ...existingFidal };
        // Only fill in missing FIDAL fields, don't overwrite existing
        for (const [k, v] of Object.entries(fidalData)) {
          if (!mergedFidal[k] && v) mergedFidal[k] = v;
        }

        const updateFields: Record<string, any> = {};
        if (birthDate && !cached.fidal_data?.birth_date_set) updateFields.birth_date = birthDate;
        if (birthPlace) updateFields.birth_place = birthPlace;
        if (codiceFiscale) updateFields.codice_fiscale = codiceFiscale;
        if (Object.keys(mergedFidal).length > 0) updateFields.fidal_data = mergedFidal;

        if (Object.keys(updateFields).length > 0) {
          await sb.from("participants").update(updateFields).eq("id", cached.id);
          cached.fidal_data = mergedFidal;
        }
        stats.participantsUpdated++;
      }

      // Skip if registration already exists for this event+participant
      if (existingRegs.has(cached.id)) {
        stats.registrationsSkipped++;
        continue;
      }

      const { error: regErr } = await sb.from("registrations").insert({
        event_id: createdEvent.id,
        participant_id: cached.id,
        nome, cognome, email: emailLower, telefono,
        birth_date: birthDate, birth_place: birthPlace,
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
        existingRegs.add(cached.id);
      }
    } catch (entryErr: any) {
      stats.errors.push(`Process error: ${entryErr.message}`);
    }
  }

  return { event_name: eventName, slug, ...stats };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { password, action, firestore_event_id } = body;

    if (!isValidAdminPassword(password)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const saJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
    if (!saJson) throw new Error("FIREBASE_SERVICE_ACCOUNT not configured");
    const sa = JSON.parse(saJson);
    const projectId = sa.project_id;
    const accessToken = await getAccessToken(sa);
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

    if (action === "list") {
      const events = await listFirestoreEvents(accessToken, baseUrl);
      return new Response(JSON.stringify({ events }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!firestore_event_id) {
      return new Response(
        JSON.stringify({ error: "Specifica firestore_event_id da importare" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const result = await importSingleEvent(firestore_event_id, accessToken, baseUrl, sb);

    return new Response(JSON.stringify(result, null, 2), {
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
