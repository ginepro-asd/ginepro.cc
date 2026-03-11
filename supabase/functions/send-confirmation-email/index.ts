import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_URL = "https://api.resend.com/emails";

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
    const { nome, cognome, email, payment_method, registration_id, event } = await req.json();

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

    const paymentLabel =
      payment_method === "stripe" ? "Carta di credito" :
      payment_method === "satispay" ? "Satispay" :
      payment_method === "paypal" ? "PayPal" : payment_method;

    const locationRow = eventLocation ? `
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;">Luogo</td>
                      <td style="padding:6px 0;color:#1a3a3a;font-size:14px;">${eventLocation}</td>
                    </tr>` : "";

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
            <h2 style="margin:0 0 8px;color:#1a3a3a;font-size:20px;">Iscrizione confermata! ✅</h2>
            <p style="margin:0 0 24px;color:#666;font-size:15px;line-height:1.6;">
              Ciao <strong>${nome}</strong>, la tua iscrizione a <strong>${eventName}</strong> è stata completata con successo.
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
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;">Evento</td>
                      <td style="padding:6px 0;color:#1a3a3a;font-size:14px;font-weight:600;">${eventDate}</td>
                    </tr>${locationRow}
                  </table>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;color:#666;font-size:14px;line-height:1.6;">
              Conserva questa email come ricevuta della tua iscrizione. Ti contatteremo con ulteriori dettagli sull'evento.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;background-color:#f8fafa;border-top:1px solid #e8eeee;text-align:center;">
            <p style="margin:0;color:#999;font-size:12px;">
              © ${new Date().getFullYear()} GINEPRO ASD<br>
              <a href="https://ginepro.lovable.app" style="color:#2d5a5a;text-decoration:none;">ginepro.lovable.app</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Ginepro ASD <info@ginepro.cc>",
        to: [email],
        subject: `Iscrizione confermata — ${eventName}`,
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
