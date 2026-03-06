import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIDAL_BASE = "https://tessonline.fidal.it";
const LEGACY_USER_AGENT = "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; Trident/4.0)";

const PROVINCE_MAP: Record<string, string> = {
  AG: "AGRIGENTO", AL: "ALESSANDRIA", AN: "ANCONA", AO: "AOSTA", AR: "AREZZO",
  AP: "ASCOLI PICENO", AT: "ASTI", AV: "AVELLINO", BA: "BARI", BT: "BARLETTA-ANDRIA-TRANI",
  BL: "BELLUNO", BN: "BENEVENTO", BG: "BERGAMO", BI: "BIELLA", BO: "BOLOGNA",
  BZ: "BOLZANO", BS: "BRESCIA", BR: "BRINDISI", CA: "CAGLIARI", CL: "CALTANISSETTA",
  CB: "CAMPOBASSO", CE: "CASERTA", CT: "CATANIA", CZ: "CATANZARO",
  CH: "CHIETI", CO: "COMO", CS: "COSENZA", CR: "CREMONA", KR: "CROTONE", CN: "CUNEO",
  EN: "ENNA", FM: "FERMO", FE: "FERRARA", FI: "FIRENZE", FG: "FOGGIA",
  FC: "FORLI'-CESENA", FR: "FROSINONE", GE: "GENOVA", GO: "GORIZIA", GR: "GROSSETO",
  IM: "IMPERIA", IS: "ISERNIA", SP: "LA SPEZIA", AQ: "L'AQUILA", LT: "LATINA",
  LE: "LECCE", LC: "LECCO", LI: "LIVORNO", LO: "LODI", LU: "LUCCA",
  MC: "MACERATA", MN: "MANTOVA", MS: "MASSA-CARRARA", MT: "MATERA",
  ME: "MESSINA", MI: "MILANO", MO: "MODENA", MB: "MONZA E DELLA BRIANZA", NA: "NAPOLI",
  NO: "NOVARA", NU: "NUORO", OR: "ORISTANO",
  PD: "PADOVA", PA: "PALERMO", PR: "PARMA", PV: "PAVIA", PG: "PERUGIA",
  PU: "PESARO E URBINO", PE: "PESCARA", PC: "PIACENZA", PI: "PISA", PT: "PISTOIA",
  PN: "PORDENONE", PZ: "POTENZA", PO: "PRATO", RG: "RAGUSA", RA: "RAVENNA",
  RC: "REGGIO CALABRIA", RE: "REGGIO EMILIA", RI: "RIETI", RN: "RIMINI", RM: "ROMA",
  RO: "ROVIGO", SA: "SALERNO", SS: "SASSARI", SV: "SAVONA", SI: "SIENA",
  SR: "SIRACUSA", SO: "SONDRIO", SU: "SUD SARDEGNA", TA: "TARANTO", TE: "TERAMO",
  TR: "TERNI", TO: "TORINO", TP: "TRAPANI", TN: "TRENTO", TV: "TREVISO",
  TS: "TRIESTE", UD: "UDINE", VA: "VARESE", VE: "VENEZIA", VB: "VERBANO-CUSIO-OSSOLA",
  VC: "VERCELLI", VR: "VERONA", VV: "VIBO VALENTIA", VI: "VICENZA", VT: "VITERBO",
};

function expandProvincia(prov: string): string {
  if (!prov) return "";
  const upper = prov.toUpperCase().trim();
  return PROVINCE_MAP[upper] || upper;
}

function extractCookies(response: Response): string[] {
  const cookies: string[] = [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      cookies.push(value.split(";")[0]);
    }
  });
  return cookies;
}

async function fidalLogin(username: string, password: string): Promise<string> {
  const body = new URLSearchParams({
    x_annoselgest: "2026",
    userid: username,
    passwd: password,
    submit: "Entra",
  });
  const res = await fetch(`${FIDAL_BASE}/login.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": LEGACY_USER_AGENT },
    body: body.toString(),
    redirect: "manual",
  });
  const cookies = extractCookies(res);
  const cookieStr = cookies.join("; ");
  if (!cookieStr.includes("PHPSESSID")) throw new Error("Login FIDAL fallito");
  return cookieStr;
}

async function uploadPhoto(cookies: string, tessera: string, photoUrl: string): Promise<string> {
  try {
    const photoRes = await fetch(photoUrl);
    if (!photoRes.ok) return "Impossibile scaricare la foto";
    const photoBytes = new Uint8Array(await photoRes.arrayBuffer());
    const formData = new FormData();
    formData.append("foto", new Blob([photoBytes], { type: "image/jpeg" }), "photo.jpg");
    formData.append("Tessera", tessera);
    const res = await fetch(`${FIDAL_BASE}/foto.php?Tessera=${tessera}`, {
      method: "POST",
      headers: { Cookie: cookies, "User-Agent": LEGACY_USER_AGENT },
      body: formData,
    });
    const text = await res.text();
    return text.includes("errore") ? "Errore caricamento foto" : "Foto caricata";
  } catch (e) {
    return `Errore foto: ${e.message}`;
  }
}

function extractFormDefaults(html: string): Record<string, string> {
  const defaults: Record<string, string> = {};
  const matches = html.match(/<input[^>]*>/gi) || [];
  for (const tag of matches) {
    const nameMatch = tag.match(/name=["']?([^"'\s>]+)/i);
    if (!nameMatch) continue;
    const typeMatch = tag.match(/type=["']?([^"'\s>]+)/i);
    const valueMatch = tag.match(/value=["']([^"']*)["']/i) || tag.match(/value=([^\s>]+)/i);
    const type = (typeMatch?.[1] || "text").toLowerCase();
    if (type === "hidden" || type === "submit" || nameMatch[1] === "Action" || nameMatch[1] === "a_add") {
      defaults[nameMatch[1]] = valueMatch?.[1] || "";
    }
  }
  return defaults;
}

/** Extract <option> values from a <select> element by name */
function extractSelectOptions(html: string, selectName: string): string[] {
  const selectRegex = new RegExp(`<select[^>]*name=["']?${selectName}["']?[^>]*>([\\s\\S]*?)</select>`, "i");
  const selectMatch = html.match(selectRegex);
  if (!selectMatch) return [];
  const optionRegex = /<option[^>]*value=["']?([^"'>]*)["']?[^>]*>/gi;
  const options: string[] = [];
  let m;
  while ((m = optionRegex.exec(selectMatch[1])) !== null) {
    if (m[1]) options.push(m[1]);
  }
  return options;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Accept both GET (open form page) and POST (submit form)
    const url = new URL(req.url);
    const isPost = req.method === "POST";

    let password: string, participantId: string, fidalDataStr: string, sessionCookies: string | null;

    if (isPost) {
      const body = await req.json();
      password = body.password;
      participantId = body.participant_id;
      fidalDataStr = JSON.stringify(body.fidal_data || {});
      sessionCookies = body.session_cookies || null;
    } else {
      password = url.searchParams.get("password") || "";
      participantId = url.searchParams.get("participant_id") || "";
      fidalDataStr = url.searchParams.get("fidal_data") || "{}";
      sessionCookies = null;
    }

    const adminPw = Deno.env.get("ADMIN_PASSWORD");
    if (!password || password !== adminPw) {
      return new Response("Unauthorized", { status: 401 });
    }

    const fidalUsername = Deno.env.get("FIDAL_USERNAME")!;
    const fidalPassword = Deno.env.get("FIDAL_PASSWORD")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get participant
    const { data: participant, error: pErr } = await supabase
      .from("participants")
      .select("*")
      .eq("id", participantId)
      .single();
    if (pErr || !participant) {
      return new Response("Partecipante non trovato", { status: 404 });
    }

    const fidalData = JSON.parse(fidalDataStr);

    // Login to FIDAL
    const cookies = sessionCookies || await fidalLogin(fidalUsername, fidalPassword);

    if (isPost) {
      // === SUBMIT MODE: submit the form to FIDAL and return result ===
      const formPage = await fetch(`${FIDAL_BASE}/insertatleadd.php?cmd=resetall`, {
        headers: { Cookie: cookies, "User-Agent": LEGACY_USER_AGENT },
      });
      const formHtml = await formPage.text();
      const defaults = extractFormDefaults(formHtml);

      // Build form data
      const formData = new URLSearchParams();
      for (const [k, v] of Object.entries(defaults)) formData.set(k, v);

      formData.set("a_add", defaults.a_add || "A");
      formData.set("x_TipoSoc", defaults.x_TipoSoc || "C");
      formData.set("x_AnnoGest", defaults.x_AnnoGest || "2026");
      formData.set("x_FlagRin", defaults.x_FlagRin || "N");
      formData.set("x_autocomm", defaults.x_autocomm || "S");
      formData.set("x_CodSoc", defaults.x_CodSoc || fidalUsername || "RA602");

      let dataNascita = "";
      if (participant.birth_date) {
        const parts = participant.birth_date.split("-");
        if (parts.length === 3) dataNascita = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }

      let luogoNascita = (participant.birth_place || "").replace(/\s*\(.*\)$/, "").toUpperCase();

      formData.set("x_nonagonista", fidalData.nonagonista || "S");
      if (fidalData.nonagonista === "S") formData.set("x_nonagonistaregola", "S");
      formData.set("x_Cognome", participant.cognome.toUpperCase());
      formData.set("x_Nome", participant.nome.toUpperCase());
      formData.set("x_DataNas", dataNascita);
      formData.set("x_Sesctr", fidalData.sesso || "");
      formData.set("x_Categoria", fidalData.categoria || "");
      formData.set("x_LuogoNas", luogoNascita);
      formData.set("x_CodFis", (participant.codice_fiscale || "").toUpperCase());
      formData.set("x_Telefono1", participant.telefono || "");
      formData.set("x_Telefono2", "");
      formData.set("x_EMail", participant.email || "");
      formData.set("x_Fax", "");
      formData.set("x_Indirizzo", (fidalData.indirizzo || "").toUpperCase());
      formData.set("x_Cap", fidalData.cap || "");
      formData.set("x_Provincia", expandProvincia(fidalData.provincia || ""));
      formData.set("x_Citta", (fidalData.citta || "").toUpperCase());
      formData.set("x_CC", ""); formData.set("x_Banca", ""); formData.set("x_Agenzia", "");
      formData.set("x_CittaBan", ""); formData.set("x_ABI", ""); formData.set("x_CAB", "");
      formData.set("x_IBAN", ""); formData.set("x_Professione", ""); formData.set("x_TitStudio", "");
      formData.set("x_codscuola", ""); formData.set("x_Regione", ""); formData.set("x_Citta2", "");
      formData.set("x_categ_svin", "");

      if (fidalData.straniero === "S") {
        formData.set("x_Straniero", "S");
        formData.set("x_Nazione", fidalData.cittadinanza || "");
      } else {
        formData.set("x_Straniero", "N");
        formData.set("x_Nazione", "ITA");
      }
      formData.set("x_doppiacitt", fidalData.doppia_cittadinanza === "S" ? "S" : "N");
      formData.set("x_Nazionegar", fidalData.doppia_cittadinanza === "S" ? (fidalData.nazionegar || "ITA") : "");
      formData.set("x_ScadCert", fidalData.scad_cert || "");

      const today = new Date();
      formData.set("x_DataMov", `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`);
      formData.set("Action", defaults.Action || "Inserisci");

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

      const hasExplicitSuccess = html.includes("INSERIMENTO EFFETTUATO") || html.includes("INSERIMENTO ESEGUITO");
      const hasError = html.includes("ERRORE") || html.includes("errore") || html.includes("Errore") || html.includes("errore.swf");

      return new Response(JSON.stringify({
        success: hasExplicitSuccess && !hasError,
        message: hasExplicitSuccess ? "Inserimento completato!" : hasError ? "Errore nell'inserimento" : "Nessuna conferma esplicita",
        html: html.substring(0, 50000),
        cookies,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === GET MODE: serve pre-filled interactive HTML form ===

    // Upload photo first
    const { data: regs } = await supabase
      .from("registrations")
      .select("custom_data")
      .eq("participant_id", participantId);

    let photoUrl: string | null = null;
    if (regs) {
      for (const reg of regs) {
        const cd = reg.custom_data as Record<string, any> | null;
        if (cd?.photoUrlThumb) { photoUrl = cd.photoUrlThumb; break; }
        if (cd?.photoUrl) photoUrl = cd.photoUrl;
      }
    }

    let photoStatus = "Nessuna foto disponibile";
    if (photoUrl) {
      photoStatus = await uploadPhoto(cookies, fidalUsername, photoUrl);
    }

    // Fetch form page to get available options
    const formPage = await fetch(`${FIDAL_BASE}/insertatleadd.php?cmd=resetall`, {
      headers: { Cookie: cookies, "User-Agent": LEGACY_USER_AGENT },
    });
    const formHtml = await formPage.text();

    // Extract province and category options from the real FIDAL form
    const provinceOptions = extractSelectOptions(formHtml, "x_Provincia");
    const categoriaOptions = extractSelectOptions(formHtml, "x_Categoria");

    // Build pre-filled values
    let dataNascita = "";
    if (participant.birth_date) {
      const parts = participant.birth_date.split("-");
      if (parts.length === 3) dataNascita = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    let luogoNascita = (participant.birth_place || "").replace(/\s*\(.*\)$/, "").toUpperCase();

    const provinciaValue = expandProvincia(fidalData.provincia || "");

    const prefilled: Record<string, string> = {
      x_Cognome: participant.cognome.toUpperCase(),
      x_Nome: participant.nome.toUpperCase(),
      x_DataNas: dataNascita,
      x_Sesctr: fidalData.sesso || "",
      x_Categoria: fidalData.categoria || "",
      x_LuogoNas: luogoNascita,
      x_CodFis: (participant.codice_fiscale || "").toUpperCase(),
      x_Telefono1: participant.telefono || "",
      x_EMail: participant.email || "",
      x_Indirizzo: (fidalData.indirizzo || "").toUpperCase(),
      x_Cap: fidalData.cap || "",
      x_Provincia: provinciaValue,
      x_Citta: (fidalData.citta || "").toUpperCase(),
      x_nonagonista: fidalData.nonagonista || "S",
      x_ScadCert: fidalData.scad_cert || "",
      x_Straniero: fidalData.straniero || "N",
      x_Nazione: fidalData.straniero === "S" ? (fidalData.cittadinanza || "") : "ITA",
    };

    // Build the proxy URL base for form submission
    const proxyBase = `${supabaseUrl}/functions/v1/fidal-form-proxy`;

    // Generate the HTML page
    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FIDAL - ${participant.nome} ${participant.cognome}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 20px; }
    .container { max-width: 700px; margin: 0 auto; }
    h1 { color: #fff; margin-bottom: 8px; font-size: 1.5rem; }
    .subtitle { color: #888; margin-bottom: 20px; font-size: 0.9rem; }
    .photo-status { padding: 10px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 0.9rem; }
    .photo-ok { background: #1a3a2a; border: 1px solid #2d5a3d; color: #6fcf97; }
    .photo-err { background: #3a1a1a; border: 1px solid #5a2d2d; color: #cf6f6f; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-size: 0.85rem; color: #aaa; margin-bottom: 4px; font-weight: 500; }
    input, select { width: 100%; padding: 10px 12px; border: 1px solid #333; border-radius: 6px; background: #16213e; color: #fff; font-size: 0.95rem; }
    input:focus, select:focus { outline: none; border-color: #4a6fa5; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .btn { padding: 12px 24px; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; width: 100%; margin-top: 20px; }
    .btn-primary { background: #4a6fa5; color: #fff; }
    .btn-primary:hover { background: #5a7fb5; }
    .btn-primary:disabled { background: #333; color: #666; cursor: not-allowed; }
    .result { padding: 16px; border-radius: 8px; margin-top: 16px; font-size: 0.9rem; }
    .result-ok { background: #1a3a2a; border: 1px solid #2d5a3d; color: #6fcf97; }
    .result-err { background: #3a1a1a; border: 1px solid #5a2d2d; color: #cf6f6f; }
    .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid #666; border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 8px; vertical-align: middle; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .debug-toggle { color: #666; cursor: pointer; font-size: 0.8rem; margin-top: 8px; }
    .debug-content { display: none; margin-top: 8px; padding: 12px; background: #111; border-radius: 6px; font-family: monospace; font-size: 0.75rem; max-height: 300px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 Inserimento FIDAL</h1>
    <p class="subtitle">${participant.nome} ${participant.cognome} — ${participant.codice_fiscale || "N/A"}</p>
    
    <div class="photo-status ${photoStatus.includes("caricata") ? "photo-ok" : "photo-err"}">
      📷 ${photoStatus}
    </div>

    <form id="fidalForm">
      <div class="row">
        <div class="form-group">
          <label>Cognome</label>
          <input name="x_Cognome" value="${prefilled.x_Cognome}" />
        </div>
        <div class="form-group">
          <label>Nome</label>
          <input name="x_Nome" value="${prefilled.x_Nome}" />
        </div>
      </div>

      <div class="row">
        <div class="form-group">
          <label>Data di nascita (gg/mm/aaaa)</label>
          <input name="x_DataNas" value="${prefilled.x_DataNas}" />
        </div>
        <div class="form-group">
          <label>Luogo di nascita</label>
          <input name="x_LuogoNas" value="${prefilled.x_LuogoNas}" />
        </div>
      </div>

      <div class="row-3">
        <div class="form-group">
          <label>Sesso</label>
          <select name="x_Sesctr">
            <option value="M" ${prefilled.x_Sesctr === "M" ? "selected" : ""}>M</option>
            <option value="F" ${prefilled.x_Sesctr === "F" ? "selected" : ""}>F</option>
          </select>
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select name="x_nonagonista">
            <option value="N" ${prefilled.x_nonagonista === "N" ? "selected" : ""}>AGONISTA</option>
            <option value="S" ${prefilled.x_nonagonista === "S" ? "selected" : ""}>NON AGONISTA</option>
          </select>
        </div>
        <div class="form-group">
          <label>Categoria</label>
          <select name="x_Categoria">
            ${categoriaOptions.length > 0
              ? categoriaOptions.map(c => `<option value="${c}" ${c === prefilled.x_Categoria ? "selected" : ""}>${c}</option>`).join("\n            ")
              : `<option value="${prefilled.x_Categoria}">${prefilled.x_Categoria}</option>`
            }
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Codice Fiscale</label>
        <input name="x_CodFis" value="${prefilled.x_CodFis}" />
      </div>

      <div class="row">
        <div class="form-group">
          <label>Telefono</label>
          <input name="x_Telefono1" value="${prefilled.x_Telefono1}" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input name="x_EMail" value="${prefilled.x_EMail}" />
        </div>
      </div>

      <div class="form-group">
        <label>Indirizzo</label>
        <input name="x_Indirizzo" value="${prefilled.x_Indirizzo}" />
      </div>

      <div class="row-3">
        <div class="form-group">
          <label>CAP</label>
          <input name="x_Cap" value="${prefilled.x_Cap}" maxlength="5" />
        </div>
        <div class="form-group">
          <label>Provincia</label>
          <select name="x_Provincia">
            <option value="">--</option>
            ${provinceOptions.length > 0
              ? provinceOptions.map(p => `<option value="${p}" ${p === provinciaValue ? "selected" : ""}>${p}</option>`).join("\n            ")
              : Object.values(PROVINCE_MAP).sort().map(p => `<option value="${p}" ${p === provinciaValue ? "selected" : ""}>${p}</option>`).join("\n            ")
            }
          </select>
        </div>
        <div class="form-group">
          <label>Città</label>
          <input name="x_Citta" value="${prefilled.x_Citta}" />
        </div>
      </div>

      <div class="row">
        <div class="form-group">
          <label>Straniero</label>
          <select name="x_Straniero">
            <option value="N" ${prefilled.x_Straniero === "N" ? "selected" : ""}>No</option>
            <option value="S" ${prefilled.x_Straniero === "S" ? "selected" : ""}>Sì</option>
          </select>
        </div>
        <div class="form-group">
          <label>Nazione</label>
          <input name="x_Nazione" value="${prefilled.x_Nazione}" />
        </div>
      </div>

      <div class="form-group">
        <label>Scadenza certificato medico (gg/mm/aaaa)</label>
        <input name="x_ScadCert" value="${prefilled.x_ScadCert}" />
      </div>

      <button type="submit" class="btn btn-primary" id="submitBtn">
        Invia a FIDAL
      </button>
    </form>

    <div id="result" style="display:none"></div>
    <div class="debug-toggle" id="debugToggle" style="display:none" onclick="document.getElementById('debugContent').style.display = document.getElementById('debugContent').style.display === 'block' ? 'none' : 'block'">
      ▶ Mostra risposta tecnica
    </div>
    <div class="debug-content" id="debugContent"></div>
  </div>

  <script>
    const PROXY_URL = "${proxyBase}";
    const PASSWORD = "${password}";
    const PARTICIPANT_ID = "${participantId}";
    let savedCookies = ${JSON.stringify(cookies)};

    document.getElementById("fidalForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("submitBtn");
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Invio in corso...';
      const resultEl = document.getElementById("result");
      resultEl.style.display = "none";

      const form = new FormData(e.target);
      const fidalData = {
        nonagonista: form.get("x_nonagonista"),
        sesso: form.get("x_Sesctr"),
        categoria: form.get("x_Categoria"),
        indirizzo: form.get("x_Indirizzo"),
        cap: form.get("x_Cap"),
        provincia: form.get("x_Provincia"),
        citta: form.get("x_Citta"),
        straniero: form.get("x_Straniero"),
        cittadinanza: form.get("x_Nazione"),
        scad_cert: form.get("x_ScadCert"),
      };

      try {
        const res = await fetch(PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            password: PASSWORD,
            participant_id: PARTICIPANT_ID,
            fidal_data: fidalData,
            session_cookies: savedCookies,
          }),
        });
        const data = await res.json();
        
        if (data.cookies) savedCookies = data.cookies;

        resultEl.style.display = "block";
        resultEl.className = "result " + (data.success ? "result-ok" : "result-err");
        resultEl.textContent = data.success ? "✅ " + data.message : "❌ " + data.message;

        if (data.html) {
          document.getElementById("debugToggle").style.display = "block";
          // Extract text from HTML for debug
          const tmp = document.createElement("div");
          tmp.innerHTML = data.html;
          document.getElementById("debugContent").textContent = tmp.innerText.substring(0, 5000);
        }
      } catch (err) {
        resultEl.style.display = "block";
        resultEl.className = "result result-err";
        resultEl.textContent = "❌ Errore: " + err.message;
      }

      btn.disabled = false;
      btn.textContent = "Invia a FIDAL";
    });
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
