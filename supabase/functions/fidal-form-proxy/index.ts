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
    if (key.toLowerCase() === "set-cookie") cookies.push(value.split(";")[0]);
  });
  return cookies;
}

async function fidalLogin(username: string, password: string): Promise<string> {
  const body = new URLSearchParams({ x_annoselgest: "2026", userid: username, passwd: password, submit: "Entra" });
  const res = await fetch(`${FIDAL_BASE}/login.php`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": LEGACY_USER_AGENT },
    body: body.toString(),
    redirect: "manual",
  });
  const cookies = extractCookies(res).join("; ");
  if (!cookies.includes("PHPSESSID")) throw new Error("Login FIDAL fallito");
  return cookies;
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
      method: "POST", headers: { Cookie: cookies, "User-Agent": LEGACY_USER_AGENT }, body: formData,
    });
    const text = await res.text();
    return text.includes("errore") ? "Errore caricamento foto" : "Foto caricata";
  } catch (e) { return `Errore foto: ${e.message}`; }
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

function extractSelectOptions(html: string, selectName: string): string[] {
  const selectRegex = new RegExp(`<select[^>]*name=["']?${selectName}["']?[^>]*>([\\s\\S]*?)</select>`, "i");
  const selectMatch = html.match(selectRegex);
  if (!selectMatch) return [];
  const optionRegex = /<option[^>]*value=["']?([^"'>]*)["']?[^>]*>/gi;
  const options: string[] = [];
  let m;
  while ((m = optionRegex.exec(selectMatch[1])) !== null) { if (m[1]) options.push(m[1]); }
  return options;
}

function buildSubmitFormData(defaults: Record<string, string>, participant: any, fidalData: any, fidalUsername: string): URLSearchParams {
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
  const luogoNascita = (participant.birth_place || "").replace(/\s*\(.*\)$/, "").toUpperCase();

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
    formData.set("x_Straniero", "S"); formData.set("x_Nazione", fidalData.cittadinanza || "");
  } else {
    formData.set("x_Straniero", "N"); formData.set("x_Nazione", "ITA");
  }
  formData.set("x_doppiacitt", fidalData.doppia_cittadinanza === "S" ? "S" : "N");
  formData.set("x_Nazionegar", fidalData.doppia_cittadinanza === "S" ? (fidalData.nazionegar || "ITA") : "");
  formData.set("x_ScadCert", fidalData.scad_cert || "");

  const today = new Date();
  formData.set("x_DataMov", `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`);
  formData.set("Action", defaults.Action || "Inserisci");

  return formData;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { password, participant_id, fidal_data, mode, session_cookies } = body;

    const adminPw = Deno.env.get("ADMIN_PASSWORD");
    if (!password || password !== adminPw) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fidalUsername = Deno.env.get("FIDAL_USERNAME")!;
    const fidalPassword = Deno.env.get("FIDAL_PASSWORD")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: participant, error: pErr } = await supabase
      .from("participants").select("*").eq("id", participant_id).single();
    if (pErr || !participant) throw new Error("Partecipante non trovato");

    const cookies = session_cookies || await fidalLogin(fidalUsername, fidalPassword);

    if (mode === "prepare") {
      // === PREPARE: login, upload photo, build interactive HTML, return as JSON ===

      // Upload photo
      const { data: regs } = await supabase
        .from("registrations").select("custom_data").eq("participant_id", participant_id);
      let photoUrl: string | null = null;
      if (regs) {
        for (const reg of regs) {
          const cd = reg.custom_data as Record<string, any> | null;
          if (cd?.photoUrlThumb) { photoUrl = cd.photoUrlThumb; break; }
          if (cd?.photoUrl) photoUrl = cd.photoUrl;
        }
      }
      const photoStatus = photoUrl ? await uploadPhoto(cookies, fidalUsername, photoUrl) : "Nessuna foto disponibile";

      // Fetch FIDAL form to get options
      const formPage = await fetch(`${FIDAL_BASE}/insertatleadd.php?cmd=resetall`, {
        headers: { Cookie: cookies, "User-Agent": LEGACY_USER_AGENT },
      });
      const formHtml = await formPage.text();
      const provinceOptions = extractSelectOptions(formHtml, "x_Provincia");
      const categoriaOptions = extractSelectOptions(formHtml, "x_Categoria");

      // Pre-fill values
      let dataNascita = "";
      if (participant.birth_date) {
        const parts = participant.birth_date.split("-");
        if (parts.length === 3) dataNascita = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const luogoNascita = (participant.birth_place || "").replace(/\s*\(.*\)$/, "").toUpperCase();
      const provinciaValue = expandProvincia(fidal_data?.provincia || "");

      const pf = {
        cognome: participant.cognome.toUpperCase(),
        nome: participant.nome.toUpperCase(),
        dataNas: dataNascita,
        luogoNas: luogoNascita,
        sesso: fidal_data?.sesso || "",
        nonagonista: fidal_data?.nonagonista || "S",
        categoria: fidal_data?.categoria || "",
        codFis: (participant.codice_fiscale || "").toUpperCase(),
        telefono: participant.telefono || "",
        email: participant.email || "",
        indirizzo: (fidal_data?.indirizzo || "").toUpperCase(),
        cap: fidal_data?.cap || "",
        provincia: provinciaValue,
        citta: (fidal_data?.citta || "").toUpperCase(),
        straniero: fidal_data?.straniero || "N",
        nazione: fidal_data?.straniero === "S" ? (fidal_data?.cittadinanza || "") : "ITA",
        scadCert: fidal_data?.scad_cert || "",
      };

      const proxyUrl = `${supabaseUrl}/functions/v1/fidal-form-proxy`;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

      const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FIDAL — ${escHtml(pf.nome)} ${escHtml(pf.cognome)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#1a1a2e;color:#e0e0e0;padding:20px}
.container{max-width:700px;margin:0 auto}
h1{color:#fff;margin-bottom:8px;font-size:1.5rem}
.sub{color:#888;margin-bottom:20px;font-size:.9rem}
.ps{padding:10px 16px;border-radius:8px;margin-bottom:20px;font-size:.9rem}
.ps-ok{background:#1a3a2a;border:1px solid #2d5a3d;color:#6fcf97}
.ps-err{background:#3a1a1a;border:1px solid #5a2d2d;color:#cf6f6f}
.fg{margin-bottom:16px}
label{display:block;font-size:.85rem;color:#aaa;margin-bottom:4px;font-weight:500}
input,select{width:100%;padding:10px 12px;border:1px solid #333;border-radius:6px;background:#16213e;color:#fff;font-size:.95rem}
input:focus,select:focus{outline:none;border-color:#4a6fa5}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.btn{padding:12px 24px;border:none;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer;width:100%;margin-top:20px}
.btn-p{background:#4a6fa5;color:#fff}.btn-p:hover{background:#5a7fb5}.btn-p:disabled{background:#333;color:#666;cursor:not-allowed}
.res{padding:16px;border-radius:8px;margin-top:16px;font-size:.9rem}
.res-ok{background:#1a3a2a;border:1px solid #2d5a3d;color:#6fcf97}
.res-err{background:#3a1a1a;border:1px solid #5a2d2d;color:#cf6f6f}
.sp{display:inline-block;width:16px;height:16px;border:2px solid #666;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;margin-right:8px;vertical-align:middle}
@keyframes spin{to{transform:rotate(360deg)}}
.dt{color:#666;cursor:pointer;font-size:.8rem;margin-top:8px}
.dc{display:none;margin-top:8px;padding:12px;background:#111;border-radius:6px;font-family:monospace;font-size:.75rem;max-height:300px;overflow:auto;white-space:pre-wrap;word-break:break-all}
</style>
</head>
<body>
<div class="container">
<h1>📋 Inserimento FIDAL</h1>
<p class="sub">${escHtml(pf.nome)} ${escHtml(pf.cognome)} — ${escHtml(pf.codFis)}</p>
<div class="ps ${photoStatus.includes("caricata") ? "ps-ok" : "ps-err"}">📷 ${escHtml(photoStatus)}</div>
<form id="f">
<div class="row"><div class="fg"><label>Cognome</label><input name="cognome" value="${escHtml(pf.cognome)}"></div><div class="fg"><label>Nome</label><input name="nome" value="${escHtml(pf.nome)}"></div></div>
<div class="row"><div class="fg"><label>Data nascita (gg/mm/aaaa)</label><input name="dataNas" value="${escHtml(pf.dataNas)}"></div><div class="fg"><label>Luogo nascita</label><input name="luogoNas" value="${escHtml(pf.luogoNas)}"></div></div>
<div class="row3">
<div class="fg"><label>Sesso</label><select name="sesso"><option value="M"${pf.sesso==="M"?" selected":""}>M</option><option value="F"${pf.sesso==="F"?" selected":""}>F</option></select></div>
<div class="fg"><label>Tipo</label><select name="nonagonista"><option value="N"${pf.nonagonista==="N"?" selected":""}>AGONISTA</option><option value="S"${pf.nonagonista==="S"?" selected":""}>NON AGONISTA</option></select></div>
<div class="fg"><label>Categoria</label><select name="categoria">${categoriaOptions.map(c=>`<option value="${escHtml(c)}"${c===pf.categoria?" selected":""}>${escHtml(c)}</option>`).join("")}</select></div>
</div>
<div class="fg"><label>Codice Fiscale</label><input name="codFis" value="${escHtml(pf.codFis)}"></div>
<div class="row"><div class="fg"><label>Telefono</label><input name="telefono" value="${escHtml(pf.telefono)}"></div><div class="fg"><label>Email</label><input name="email" value="${escHtml(pf.email)}"></div></div>
<div class="fg"><label>Indirizzo</label><input name="indirizzo" value="${escHtml(pf.indirizzo)}"></div>
<div class="row3">
<div class="fg"><label>CAP</label><input name="cap" value="${escHtml(pf.cap)}" maxlength="5"></div>
<div class="fg"><label>Provincia</label><select name="provincia"><option value="">--</option>${(provinceOptions.length>0?provinceOptions:Object.values(PROVINCE_MAP).sort()).map(p=>`<option value="${escHtml(p)}"${p===pf.provincia?" selected":""}>${escHtml(p)}</option>`).join("")}</select></div>
<div class="fg"><label>Città</label><input name="citta" value="${escHtml(pf.citta)}"></div>
</div>
<div class="row"><div class="fg"><label>Straniero</label><select name="straniero"><option value="N"${pf.straniero==="N"?" selected":""}>No</option><option value="S"${pf.straniero==="S"?" selected":""}>Sì</option></select></div><div class="fg"><label>Nazione</label><input name="nazione" value="${escHtml(pf.nazione)}"></div></div>
<div class="fg"><label>Scadenza cert. medico (gg/mm/aaaa)</label><input name="scadCert" value="${escHtml(pf.scadCert)}"></div>
<button type="submit" class="btn btn-p" id="btn">Invia a FIDAL</button>
</form>
<div id="res" style="display:none"></div>
<div class="dt" id="dt" style="display:none" onclick="document.getElementById('dc').style.display=document.getElementById('dc').style.display==='block'?'none':'block'">▶ Mostra risposta tecnica</div>
<div class="dc" id="dc"></div>
</div>
<script>
const PROXY="${escHtml(proxyUrl)}";
const PW="${escHtml(password)}";
const PID="${escHtml(participant_id)}";
const AKEY="${escHtml(anonKey)}";
let SC=${JSON.stringify(cookies)};
document.getElementById("f").addEventListener("submit",async e=>{
e.preventDefault();
const b=document.getElementById("btn");b.disabled=true;b.innerHTML='<span class="sp"></span> Invio in corso...';
const r=document.getElementById("res");r.style.display="none";
const fd=new FormData(e.target);
const d={nonagonista:fd.get("nonagonista"),sesso:fd.get("sesso"),categoria:fd.get("categoria"),
indirizzo:fd.get("indirizzo"),cap:fd.get("cap"),provincia:fd.get("provincia"),citta:fd.get("citta"),
straniero:fd.get("straniero"),cittadinanza:fd.get("nazione"),scad_cert:fd.get("scadCert")};
try{
const res=await fetch(PROXY,{method:"POST",headers:{"Content-Type":"application/json","apikey":AKEY,"Authorization":"Bearer "+AKEY},
body:JSON.stringify({password:PW,participant_id:PID,fidal_data:d,session_cookies:SC,mode:"submit"})});
const data=await res.json();
if(data.cookies)SC=data.cookies;
r.style.display="block";r.className="res "+(data.success?"res-ok":"res-err");
r.textContent=data.success?"✅ "+data.message:"❌ "+data.message;
if(data.html){document.getElementById("dt").style.display="block";
const t=document.createElement("div");t.innerHTML=data.html;document.getElementById("dc").textContent=t.innerText.substring(0,5000);}
}catch(err){r.style.display="block";r.className="res res-err";r.textContent="❌ "+err.message;}
b.disabled=false;b.textContent="Invia a FIDAL";
});
</script>
</body></html>`;

      return new Response(JSON.stringify({ html, cookies, photoStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      // === SUBMIT: submit the form to FIDAL ===
      const formPage = await fetch(`${FIDAL_BASE}/insertatleadd.php?cmd=resetall`, {
        headers: { Cookie: cookies, "User-Agent": LEGACY_USER_AGENT },
      });
      const formHtml = await formPage.text();
      const defaults = extractFormDefaults(formHtml);
      const formData = buildSubmitFormData(defaults, participant, fidal_data, fidalUsername);

      const res = await fetch(`${FIDAL_BASE}/insertatleadd.php`, {
        method: "POST",
        headers: { Cookie: cookies, "Content-Type": "application/x-www-form-urlencoded", "User-Agent": LEGACY_USER_AGENT },
        body: formData.toString(),
      });
      const html = await res.text();
      const hasSuccess = html.includes("INSERIMENTO EFFETTUATO") || html.includes("INSERIMENTO ESEGUITO");
      const hasError = html.includes("ERRORE") || html.includes("errore") || html.includes("errore.swf");

      return new Response(JSON.stringify({
        success: hasSuccess && !hasError,
        message: hasSuccess ? "Inserimento completato!" : hasError ? "Errore nell'inserimento" : "Nessuna conferma esplicita",
        html: html.substring(0, 50000),
        cookies,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
