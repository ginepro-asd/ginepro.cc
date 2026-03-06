import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIDAL_BASE = "https://tessonline.fidal.it";
const LEGACY_USER_AGENT = "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; Trident/4.0)";

/** Extract Set-Cookie values from response headers */
function extractCookies(response: Response): string[] {
  const cookies: string[] = [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      const cookiePart = value.split(";")[0];
      cookies.push(cookiePart);
    }
  });
  return cookies;
}

/** Login to FIDAL and return session cookie string */
async function fidalLogin(username: string, password: string): Promise<string> {
  const body = new URLSearchParams({
    x_annoselgest: "2026",
    userid: username,
    passwd: password,
    submit: "Entra",
  });

  const res = await fetch(`${FIDAL_BASE}/login.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": LEGACY_USER_AGENT,
    },
    body: body.toString(),
    redirect: "manual",
  });

  const cookies = extractCookies(res);
  const cookieStr = cookies.join("; ");

  if (!cookieStr.includes("PHPSESSID")) {
    // Try to get cookies from response even if not redirect
    const text = await res.text();
    throw new Error("Login fallito: nessun cookie di sessione ricevuto");
  }

  return cookieStr;
}

/** Upload photo to FIDAL */
async function fidalUploadPhoto(
  cookies: string,
  tessera: string,
  photoBytes: Uint8Array,
  photoName: string,
): Promise<{ success: boolean; message: string }> {
  // First, GET the foto page to understand the form
  const fotoPage = await fetch(`${FIDAL_BASE}/foto.php?Tessera=${tessera}`, {
    headers: {
      Cookie: cookies,
      "User-Agent": LEGACY_USER_AGENT,
    },
  });
  const fotoHtml = await fotoPage.text();

  // Build multipart form for photo upload
  const formData = new FormData();
  const blob = new Blob([photoBytes], { type: "image/jpeg" });
  formData.append("foto", blob, photoName || "photo.jpg");
  formData.append("Tessera", tessera);

  const res = await fetch(`${FIDAL_BASE}/foto.php?Tessera=${tessera}`, {
    method: "POST",
    headers: {
      Cookie: cookies,
      "User-Agent": LEGACY_USER_AGENT,
    },
    body: formData,
  });

  const text = await res.text();
  return {
    success: res.ok,
    message: text.includes("errore") || text.includes("Errore")
      ? "Possibile errore nel caricamento foto"
      : "Foto caricata",
  };
}

/** Submit athlete form to FIDAL */
async function fidalSubmitAthlete(
  cookies: string,
  data: Record<string, string>,
): Promise<{ success: boolean; message: string; html: string }> {
  const formData = new URLSearchParams();

  // Fixed hidden fields
  formData.set("a_add", "A");
  formData.set("x_TipoSoc", "C");
  formData.set("x_AnnoGest", "2026");
  formData.set("x_FlagRin", "N");
  formData.set("x_autocomm", "S");
  formData.set("x_CodSoc", data.tessera || "RA602");

  // Required fields from our data
  formData.set("x_nonagonista", data.nonagonista || "S");
  if (data.nonagonista === "S") {
    formData.set("x_nonagonistaregola", "S");
  }
  formData.set("x_Cognome", data.cognome || "");
  formData.set("x_Nome", data.nome || "");
  formData.set("x_DataNas", data.data_nascita || ""); // dd/mm/yyyy
  formData.set("x_Sesctr", data.sesso || "");
  formData.set("x_Categoria", data.categoria || "");
  formData.set("x_LuogoNas", data.luogo_nascita || "");
  formData.set("x_CodFis", data.codice_fiscale || "");
  formData.set("x_Telefono1", data.telefono || "");
  formData.set("x_Telefono2", "");
  formData.set("x_EMail", data.email || "");
  formData.set("x_Fax", "");
  formData.set("x_Indirizzo", data.indirizzo || "");
  formData.set("x_Cap", data.cap || "");
  formData.set("x_Provincia", data.provincia || "");
  formData.set("x_Citta", data.citta || "");
  formData.set("x_CC", "");
  formData.set("x_Banca", "");
  formData.set("x_Agenzia", "");
  formData.set("x_CittaBan", "");
  formData.set("x_ABI", "");
  formData.set("x_CAB", "");
  formData.set("x_IBAN", "");
  formData.set("x_Professione", "");
  formData.set("x_TitStudio", "");
  formData.set("x_codscuola", "");
  formData.set("x_Regione", "");
  formData.set("x_Citta2", "");
  formData.set("x_categ_svin", "");

  // Citizenship
  if (data.straniero === "S") {
    formData.set("x_Straniero", "S");
    formData.set("x_Nazione", data.cittadinanza || "");
  } else {
    formData.set("x_Straniero", "N");
    formData.set("x_Nazione", "ITA");
  }

  // Dual citizenship
  if (data.doppia_cittadinanza === "S") {
    formData.set("x_doppiacitt", "S");
    formData.set("x_Nazionegar", data.nazionegar || "ITA");
  } else {
    formData.set("x_doppiacitt", "N");
    formData.set("x_Nazionegar", "");
  }

  // Medical cert expiry
  formData.set("x_ScadCert", data.scad_cert || "");

  // Today's date as movement date
  const today = new Date();
  const dataMov = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
  formData.set("x_DataMov", dataMov);

  formData.set("Action", "Inserisci");

  const res = await fetch(`${FIDAL_BASE}/insertatleadd.php`, {
    method: "POST",
    headers: {
      Cookie: cookies,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": LEGACY_USER_AGENT,
    },
    body: formData.toString(),
  });

  const html = await res.text();

  // Detect explicit legacy-browser rejection page
  const blockedByUserAgent =
    html.includes("necessario utilizzare") &&
    html.includes("Internet Explorer");

  // Detect explicit error patterns from FIDAL pages
  const hasError =
    html.includes("ERRORE") ||
    html.includes("errore") ||
    html.includes("Errore") ||
    html.includes("audio/errore.swf") ||
    html.includes("errore.swf");

  // Accept success only with explicit confirmation text
  const hasExplicitSuccess =
    html.includes("INSERIMENTO EFFETTUATO") ||
    html.includes("INSERIMENTO ESEGUITO");

  const finalSuccess = !blockedByUserAgent && !hasError && hasExplicitSuccess;

  return {
    success: finalSuccess,
    message: blockedByUserAgent
      ? "FIDAL ha rifiutato la richiesta per controllo browser (legacy)."
      : hasError
        ? "Possibile errore nell'inserimento"
        : hasExplicitSuccess
          ? "Atleta inserito con successo"
          : "FIDAL non ha restituito una conferma esplicita di inserimento",
    html: html.substring(0, 2000), // First 2000 chars for debugging
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, participant_id, fidal_data, action } = await req.json();

    // Verify admin password
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!password || password !== adminPassword) {
      return new Response(JSON.stringify({ error: "Password non valida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fidalUsername = Deno.env.get("FIDAL_USERNAME");
    const fidalPassword = Deno.env.get("FIDAL_PASSWORD");
    if (!fidalUsername || !fidalPassword) {
      return new Response(
        JSON.stringify({ error: "Credenziali FIDAL non configurate" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Step 1: Login to FIDAL
    console.log("Logging in to FIDAL...");
    const cookies = await fidalLogin(fidalUsername, fidalPassword);
    console.log("Login successful");

    // Get participant data from DB
    const { data: participant, error: pErr } = await supabase
      .from("participants")
      .select("*")
      .eq("id", participant_id)
      .single();

    if (pErr || !participant) {
      throw new Error("Partecipante non trovato");
    }

    // Get photo URL from registrations
    const { data: regs } = await supabase
      .from("registrations")
      .select("custom_data")
      .eq("participant_id", participant_id);

    let photoUrl: string | null = null;
    if (regs) {
      for (const reg of regs) {
        const cd = reg.custom_data as Record<string, any> | null;
        // Prefer thumbnail (200px) over original
        if (cd?.photoUrlThumb) {
          photoUrl = cd.photoUrlThumb;
          break;
        }
        if (cd?.photoUrl) {
          photoUrl = cd.photoUrl;
        }
      }
    }

    // Format birth date from YYYY-MM-DD to DD/MM/YYYY
    let dataNascita = "";
    if (participant.birth_date) {
      const parts = participant.birth_date.split("-");
      if (parts.length === 3) {
        dataNascita = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    // Derive gender from codice fiscale (month digit > 40 means female)
    let sesso = fidal_data?.sesso || "";
    if (!sesso && participant.codice_fiscale && participant.codice_fiscale.length >= 12) {
      const monthDay = parseInt(participant.codice_fiscale.substring(9, 11));
      sesso = monthDay > 40 ? "F" : "M";
    }

    // Extract birth place for FIDAL (just the comune name, no province)
    let luogoNascita = participant.birth_place || "";
    // Remove province in parentheses if present, e.g. "Faenza (RA)" -> "FAENZA"
    luogoNascita = luogoNascita.replace(/\s*\(.*\)$/, "").toUpperCase();

    const formData: Record<string, string> = {
      tessera: fidalUsername,
      nonagonista: fidal_data?.nonagonista || "S",
      cognome: participant.cognome.toUpperCase(),
      nome: participant.nome.toUpperCase(),
      data_nascita: dataNascita,
      sesso,
      categoria: fidal_data?.categoria || "",
      luogo_nascita: luogoNascita,
      codice_fiscale: (participant.codice_fiscale || "").toUpperCase(),
      telefono: participant.telefono || "",
      email: participant.email || "",
      indirizzo: (fidal_data?.indirizzo || "").toUpperCase(),
      cap: fidal_data?.cap || "",
      provincia: fidal_data?.provincia || "",
      citta: (fidal_data?.citta || "").toUpperCase(),
      straniero: fidal_data?.straniero || "N",
      cittadinanza: fidal_data?.cittadinanza || "ITA",
      doppia_cittadinanza: fidal_data?.doppia_cittadinanza || "N",
      nazionegar: fidal_data?.nazionegar || "ITA",
      scad_cert: fidal_data?.scad_cert || "",
    };

    // Step 2: Upload photo if available
    let photoResult = { success: true, message: "Nessuna foto" };
    if (photoUrl) {
      console.log("Downloading photo from Firebase...");
      try {
        const photoRes = await fetch(photoUrl);
        if (photoRes.ok) {
          const photoBytes = new Uint8Array(await photoRes.arrayBuffer());
          const fileName = `${participant.cognome}_${participant.nome}.jpg`;
          console.log("Uploading photo to FIDAL...");
          photoResult = await fidalUploadPhoto(cookies, fidalUsername, photoBytes, fileName);
          console.log("Photo upload result:", photoResult.message);
        } else {
          photoResult = { success: false, message: "Impossibile scaricare la foto" };
        }
      } catch (e) {
        photoResult = { success: false, message: `Errore foto: ${e.message}` };
      }
    }

    // Step 3: Submit athlete form
    console.log("Submitting athlete form...");
    const submitResult = await fidalSubmitAthlete(cookies, formData);
    console.log("Submit result:", submitResult.message);

    // Save fidal_data to participant for future reference
    await supabase
      .from("participants")
      .update({ fidal_data: { ...fidal_data, last_submitted: new Date().toISOString() } })
      .eq("id", participant_id);

    return new Response(
      JSON.stringify({
        success: submitResult.success,
        photo: photoResult,
        submit: { success: submitResult.success, message: submitResult.message },
        debug_html: submitResult.html,
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
