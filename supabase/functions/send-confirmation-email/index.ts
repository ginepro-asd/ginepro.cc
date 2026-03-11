import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_URL = "https://api.resend.com/emails";
const APP_URL = "https://ginepro.lovable.app";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Da definire";
  const d = new Date(dateStr);
  const months = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nome, cognome, email, payment_method, registration_id, event, card } = await req.json();

    if (!email || !nome || !cognome) {
      throw new Error("Missing required fields: nome, cognome, email");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // Event info with fallbacks
    const eventName = event?.nome || "Evento Ginepro";
    const eventDate = event?.data_evento ? formatDate(event.data_evento) : "Da definire";
    const eventLocation = event?.luogo || "";
    const isTesseramento = event?.is_tesseramento || false;

    const paymentLabel =
      payment_method === "stripe" ? "Carta di credito" :
      payment_method === "satispay" ? "Satispay" :
      payment_method === "paypal" ? "PayPal" : payment_method;

    const locationRow = eventLocation ? `
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;">Luogo</td>
                      <td style="padding:6px 0;color:#1a3a3a;font-size:14px;">${eventLocation}</td>
                    </tr>` : "";

    // Membership card row (only for tesseramento)
    const cardRow = card?.card_number ? `
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;">N° Tessera</td>
                      <td style="padding:6px 0;color:#1a3a3a;font-size:14px;font-weight:600;">${card.card_number}</td>
                    </tr>` : "";

    // Card CTA button (only for tesseramento with card)
    const cardLink = card?.id ? `${APP_URL}/card/${card.id}` : "";
    const cardSection = cardLink ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
              <tr><td align="center">
                <a href="${cardLink}" style="display:inline-block;background:linear-gradient(135deg,#1a3a3a,#2d5a5a);color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.5px;">
                  🪪 Visualizza la tua tessera
                </a>
              </td></tr>
            </table>` : "";

    // Private area CTA (only for tesseramento)
    const privateAreaSection = isTesseramento ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
              <tr><td align="center">
                <a href="${APP_URL}/area-riservata" style="display:inline-block;background-color:#f8fafa;color:#1a3a3a;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;border:1px solid #e8eeee;">
                  Accedi alla tua area riservata →
                </a>
              </td></tr>
            </table>` : "";

    // Adjust body text for tesseramento vs regular event
    const bodyText = isTesseramento
      ? `Ciao <strong>${nome}</strong>, il tuo tesseramento <strong>${eventName}</strong> è stato completato con successo.`
      : `Ciao <strong>${nome}</strong>, la tua iscrizione a <strong>${eventName}</strong> è stata completata con successo.`;

    const footerText = isTesseramento
      ? `Conserva questa email come ricevuta del tuo tesseramento. Puoi accedere alla tua tessera digitale e alla tua area riservata in qualsiasi momento dai link sopra.`
      : `Conserva questa email come ricevuta della tua iscrizione. Ti contatteremo con ulteriori dettagli sull'evento.`;

    const htmlBody = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a3a3a,#2d5a5a);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">${eventName}</h1>
            <p style="margin:8px 0 0;color:#f0a090;font-size:14px;font-weight:600;">by GINEPRO</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#1a3a3a;font-size:20px;">${isTesseramento ? "Tesseramento completato! ✅" : "Iscrizione confermata! ✅"}</h2>
            <p style="margin:0 0 24px;color:#666;font-size:15px;line-height:1.6;">
              ${bodyText}
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafa;border-radius:8px;border:1px solid #e8eeee;">
              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;width:140px;">Nome</td>
                      <td style="padding:6px 0;color:#1a3a3a;font-size:14px;font-weight:600;">${nome} ${cognome}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;">Email</td>
                      <td style="padding:6px 0;color:#1a3a3a;font-size:14px;">${email}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;">Pagamento</td>
                      <td style="padding:6px 0;color:#1a3a3a;font-size:14px;">${paymentLabel}</td>
                    </tr>${cardRow}
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;">${isTesseramento ? "Anno" : "Evento"}</td>
                      <td style="padding:6px 0;color:#1a3a3a;font-size:14px;font-weight:600;">${eventDate}</td>
                    </tr>${locationRow}
                  </table>
                </td>
              </tr>
            </table>${cardSection}${privateAreaSection}
            <p style="margin:24px 0 0;color:#666;font-size:14px;line-height:1.6;">
              ${footerText}
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;background-color:#f8fafa;border-top:1px solid #e8eeee;text-align:center;">
            <p style="margin:0;color:#999;font-size:12px;">
              © ${new Date().getFullYear()} GINEPRO ASD<br>
              <a href="${APP_URL}" style="color:#2d5a5a;text-decoration:none;">ginepro.lovable.app</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const subject = isTesseramento
      ? `Tesseramento completato — ${eventName}`
      : `Iscrizione confermata — ${eventName}`;

    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Ginepro ASD <info@ginepro.cc>",
        to: [email],
        subject,
        html: htmlBody,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("Resend error:", res.status, JSON.stringify(result));
      throw new Error(`Resend error: ${res.status} - ${JSON.stringify(result)}`);
    }

    console.log("Confirmation email sent to:", email, "id:", result.id);

    return new Response(
      JSON.stringify({ success: true, email_id: result.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error sending email:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
