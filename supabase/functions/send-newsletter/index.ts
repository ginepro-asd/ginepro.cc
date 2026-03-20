import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_URL = "https://api.resend.com/emails";
const APP_URL = "https://ginepro.cc";
const BATCH_SIZE = 200;

function buildEmailHtml(nome: string, participantId: string, newsletter: { slug: string; subject: string; cta_url: string; body_html: string | null }) {
  const ctaLink = `${APP_URL}/newsletter/${newsletter.slug}?action=cta&pid=${participantId}`;
  const unsubscribeLink = `${APP_URL}/newsletter/${newsletter.slug}?action=unsubscribe&pid=${participantId}`;

  if (!newsletter.body_html) {
    throw new Error("Newsletter body_html is empty. Please add HTML content to the newsletter record.");
  }

  return newsletter.body_html
    .replace(/\{\{nome\}\}/g, nome)
    .replace(/\{\{cta_link\}\}/g, ctaLink)
    .replace(/\{\{unsubscribe_link\}\}/g, unsubscribeLink);
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

    // If test_email, send only to that email
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

    // Production: get all subscribers
    const { data: participants, error: pErr } = await supabase
      .from("participants")
      .select("id, nome, email")
      .eq("newsletter", true);

    if (pErr) throw new Error("Error fetching participants: " + pErr.message);
    if (!participants?.length) throw new Error("No subscribers found");

    // Get already-sent participant IDs for this newsletter
    const { data: alreadySent } = await supabase
      .from("newsletter_sends")
      .select("participant_id")
      .eq("newsletter_id", newsletter.id);

    const sentIds = new Set((alreadySent || []).map((s: any) => s.participant_id));
    const remaining = participants.filter((p: any) => !sentIds.has(p.id));

    if (remaining.length === 0) {
      // All sent — mark newsletter as sent if not already
      if (!newsletter.sent_at) {
        await supabase
          .from("newsletters")
          .update({ sent_at: new Date().toISOString() })
          .eq("slug", newsletter_slug);
      }
      return new Response(
        JSON.stringify({ success: true, sent: 0, errors: 0, total: participants.length, already_sent: sentIds.size, remaining: 0, batch_complete: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Take only BATCH_SIZE
    const batch = remaining.slice(0, BATCH_SIZE);

    let sent = 0;
    let errors = 0;
    for (const p of batch) {
      try {
        const subject = newsletter.subject.replace("<Nome>", p.nome);
        const html = buildEmailHtml(p.nome, p.id, newsletter);

        const res = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "Ginepro ASD <info@ginepro.cc>", to: [p.email], subject, html }),
        });

        const success = res.ok;
        if (success) {
          sent++;
        } else {
          errors++;
          const errBody = await res.text();
          console.error(`Failed for ${p.email}:`, errBody);
        }

        // Track the send
        await supabase.from("newsletter_sends").upsert({
          newsletter_id: newsletter.id,
          participant_id: p.id,
          success,
        });

        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        errors++;
        console.error(`Error sending to ${p.email}:`, e.message);
        // Still track as failed
        await supabase.from("newsletter_sends").upsert({
          newsletter_id: newsletter.id,
          participant_id: p.id,
          success: false,
        });
      }
    }

    const newRemaining = remaining.length - batch.length;
    const totalSent = sentIds.size + sent;

    console.log(`Batch done: ${sent} ok, ${errors} errors. Total sent so far: ${totalSent}/${participants.length}. Remaining: ${newRemaining}`);

    // Mark as sent only when all done
    if (newRemaining === 0 && !newsletter.sent_at) {
      await supabase
        .from("newsletters")
        .update({ sent_at: new Date().toISOString() })
        .eq("slug", newsletter_slug);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        errors,
        total: participants.length,
        already_sent: sentIds.size,
        remaining: newRemaining,
        batch_complete: newRemaining === 0,
      }),
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
