import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_URL = "https://api.resend.com/emails";
const APP_URL = "https://ginepro.cc";

function buildEmailHtml(nome: string, participantId: string, newsletter: { slug: string; subject: string; cta_url: string }) {
  const ctaLink = `${APP_URL}/newsletter/${newsletter.slug}?action=cta&pid=${participantId}`;
  const unsubscribeLink = `${APP_URL}/newsletter/${newsletter.slug}?action=unsubscribe&pid=${participantId}`;

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a3a3a,#2d5a5a);padding:32px 40px;text-align:center;">
            <p style="margin:0;color:#f0a090;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;">GINEPRO ASD</p>
            <h1 style="margin:12px 0 0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">🏔️ Tredozio Trail 2026</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 20px;color:#333;font-size:15px;line-height:1.7;">
              Ciao <strong>${nome}</strong>,
            </p>
            <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.7;">
              ti scriviamo da <strong>GINEPRO</strong> perché in passato hai partecipato ad alcuni dei nostri eventi — e speriamo che l'esperienza ti sia piaciuta!
            </p>
            <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.7;">
              Questo è il primo messaggio della nostra newsletter: niente spam, niente pubblicità — solo aggiornamenti sulle nostre attività, per tenerti sul pezzo. 🎯
            </p>
            <p style="margin:0 0 24px;color:#333;font-size:15px;line-height:1.7;">
              E a proposito di restare sul pezzo: le iscrizioni a <strong>Tredozio Trail 2026</strong> chiudono il <strong>23 Marzo</strong>. La gara si terrà il <strong>29 Marzo</strong> — se non ti sei ancora iscritto, è il momento giusto!
            </p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 32px;">
              <tr><td align="center">
                <a href="${ctaLink}" style="display:inline-block;background:linear-gradient(135deg,#f0a090,#e8816e);color:#ffffff;padding:16px 40px;border-radius:8px;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 12px rgba(240,160,144,0.4);">
                  🏃 Iscriviti ora!
                </a>
              </td></tr>
            </table>

            <p style="margin:0;color:#999;font-size:13px;line-height:1.6;">
              Ci vediamo sui sentieri,<br>
              <strong style="color:#1a3a3a;">Il team GINEPRO</strong>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;background-color:#f8fafa;border-top:1px solid #e8eeee;text-align:center;">
            <p style="margin:0 0 12px;color:#999;font-size:12px;">
              © ${new Date().getFullYear()} GINEPRO ASD · <a href="${APP_URL}" style="color:#2d5a5a;text-decoration:none;">ginepro.lovable.app</a>
            </p>
            <p style="margin:0;">
              <a href="${unsubscribeLink}" style="color:#bbb;font-size:11px;text-decoration:underline;">
                Se non vuoi più ricevere queste comunicazioni, disiscriviti qui
              </a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { newsletter_slug, test_email } = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch newsletter
    const { data: newsletter, error: nlErr } = await supabase
      .from("newsletters")
      .select("*")
      .eq("slug", newsletter_slug)
      .single();

    if (nlErr || !newsletter) throw new Error("Newsletter not found: " + newsletter_slug);

    // If test_email, send only to that email (find or fake participant)
    if (test_email) {
      const { data: participant } = await supabase
        .from("participants")
        .select("id, nome")
        .eq("email", test_email)
        .maybeSingle();

      const nome = participant?.nome || "Utente";
      const pid = participant?.id || "test";
      const subject = newsletter.subject.replace("<Nome>", nome);
      const html = buildEmailHtml(nome, pid, newsletter);

      const res = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "Ginepro ASD <info@ginepro.cc>", to: [test_email], subject, html }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(result)}`);

      console.log("Test email sent to:", test_email);
      return new Response(JSON.stringify({ success: true, test: true, email_id: result.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Production: send to all participants with newsletter=true
    const { data: participants, error: pErr } = await supabase
      .from("participants")
      .select("id, nome, email")
      .eq("newsletter", true);

    if (pErr) throw new Error("Error fetching participants: " + pErr.message);
    if (!participants?.length) throw new Error("No subscribers found");

    let sent = 0;
    let errors = 0;
    for (const p of participants) {
      try {
        const subject = newsletter.subject.replace("<Nome>", p.nome);
        const html = buildEmailHtml(p.nome, p.id, newsletter);

        const res = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Ginepro ASD <info@ginepro.cc>", to: [p.email], subject, html }),
        });

        if (res.ok) {
          sent++;
        } else {
          errors++;
          const errBody = await res.text();
          console.error(`Failed for ${p.email}:`, errBody);
        }

        // Rate limiting: small delay between sends
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        errors++;
        console.error(`Error sending to ${p.email}:`, e.message);
      }
    }

    console.log(`Newsletter sent: ${sent} ok, ${errors} errors out of ${participants.length}`);

    return new Response(
      JSON.stringify({ success: true, sent, errors, total: participants.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
