import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SENDER_DOMAIN = "notify.ginepro.cc";
const FROM_ADDRESS = "Ginepro ASD <info@ginepro.cc>";

function resolveTemplate(
  html: string,
  vars: Record<string, string>,
): string {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value || "");
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { event_email_id, registration_id, event_id, mode, password, test_email } = body;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify admin password for bulk/test sends
    if (mode === "bulk" || mode === "test") {
      const adminPassword = Deno.env.get("ADMIN_PASSWORD");
      if (!password || password !== adminPassword) {
        throw new Error("Unauthorized");
      }
    }

    if (!event_email_id) {
      throw new Error("Missing event_email_id");
    }

    // Load the email template
    const { data: template, error: templateErr } = await supabaseAdmin
      .from("event_emails")
      .select("*")
      .eq("id", event_email_id)
      .single();
    if (templateErr || !template) throw new Error("Template not found");

    const orarioMap: Record<string, string> = template.orario_map || {};

    // Helper to enqueue a single email via Lovable Email queue
    const enqueueOne = async (reg: any): Promise<{ registration_id: string; status: string; error?: string }> => {
      const disciplina = reg.custom_data?.disciplina || "";
      const orario = orarioMap[disciplina] || "";

      const vars: Record<string, string> = {
        nome: reg.nome || "",
        cognome: reg.cognome || "",
        email: reg.email || "",
        orario,
        disciplina,
        telefono: reg.telefono || "",
      };

      const htmlBody = resolveTemplate(template.body_html || "", vars);
      const subject = resolveTemplate(template.subject || "", vars);
      const messageId = crypto.randomUUID();
      const idempotencyKey = `event-email-${event_email_id}-${reg.id}`;

      try {
        const textBody = htmlBody
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();

        const payload = {
          to: reg.email,
          from: FROM_ADDRESS,
          sender_domain: SENDER_DOMAIN,
          subject,
          html: htmlBody,
          text: textBody,
          purpose: "transactional",
          label: `event-email-${template.slug}`,
          idempotency_key: idempotencyKey,
          message_id: messageId,
          queued_at: new Date().toISOString(),
        };

        const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload,
        });

        if (enqueueError) {
          console.error("Enqueue error:", enqueueError);
          await supabaseAdmin.from("event_email_sends").upsert({
            event_email_id,
            registration_id: reg.id,
            status: "failed",
            error: enqueueError.message,
          }, { onConflict: "event_email_id,registration_id" });
          return { registration_id: reg.id, status: "failed", error: enqueueError.message };
        }

        // Log pending in email_send_log
        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: `event-email-${template.slug}`,
          recipient_email: reg.email,
          status: "pending",
        });

        // Log success in event_email_sends
        await supabaseAdmin.from("event_email_sends").upsert({
          event_email_id,
          registration_id: reg.id,
          status: "sent",
          error: null,
        }, { onConflict: "event_email_id,registration_id" });

        return { registration_id: reg.id, status: "sent" };
      } catch (err) {
        await supabaseAdmin.from("event_email_sends").upsert({
          event_email_id,
          registration_id: reg.id,
          status: "failed",
          error: err.message,
        }, { onConflict: "event_email_id,registration_id" });
        return { registration_id: reg.id, status: "failed", error: err.message };
      }
    };

    // MODE: test — send to a test email
    if (mode === "test") {
      if (!test_email) throw new Error("Missing test_email");
      const fakeReg = {
        id: "00000000-0000-0000-0000-000000000000",
        nome: "Test",
        cognome: "Utente",
        email: test_email,
        telefono: "+39 000 0000000",
        custom_data: { disciplina: Object.keys(orarioMap)[0] || "" },
      };

      const disciplina = fakeReg.custom_data.disciplina;
      const htmlBody = resolveTemplate(template.body_html || "", {
        nome: fakeReg.nome,
        cognome: fakeReg.cognome,
        email: fakeReg.email,
        orario: orarioMap[disciplina] || "",
        disciplina,
        telefono: fakeReg.telefono,
      });
      const subject = resolveTemplate(template.subject || "", { nome: fakeReg.nome });
      const messageId = crypto.randomUUID();
      const textBody = htmlBody
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();

      const payload = {
        to: test_email,
        from: FROM_ADDRESS,
        sender_domain: SENDER_DOMAIN,
        subject: `[TEST] ${subject}`,
        html: htmlBody,
        text: textBody,
        purpose: "transactional",
        label: `event-email-${template.slug}-test`,
        idempotency_key: `test-${event_email_id}-${Date.now()}`,
        message_id: messageId,
        queued_at: new Date().toISOString(),
      };

      const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload,
      });

      if (enqueueError) throw new Error(`Enqueue error: ${enqueueError.message}`);

      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: `event-email-${template.slug}-test`,
        recipient_email: test_email,
        status: "pending",
      });

      return new Response(
        JSON.stringify({ status: "test_queued", message_id: messageId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // MODE: single — send to one registration
    if (!mode || mode === "single") {
      if (!registration_id) throw new Error("Missing registration_id");

      const { data: reg } = await supabaseAdmin
        .from("registrations")
        .select("id, nome, cognome, email, telefono, custom_data")
        .eq("id", registration_id)
        .single();
      if (!reg) throw new Error("Registration not found");

      const result = await enqueueOne(reg);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // MODE: bulk — send to all completed registrations for the event
    if (mode === "bulk") {
      const targetEventId = event_id || template.event_id;
      if (!targetEventId) throw new Error("Missing event_id for bulk send");

      const { data: registrations } = await supabaseAdmin
        .from("registrations")
        .select("id, nome, cognome, email, telefono, custom_data")
        .eq("event_id", targetEventId)
        .eq("payment_status", "completed");

      if (!registrations || registrations.length === 0) {
        return new Response(
          JSON.stringify({ status: "no_recipients", sent: 0, failed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Get already-sent registrations for this template
      const { data: alreadySent } = await supabaseAdmin
        .from("event_email_sends")
        .select("registration_id")
        .eq("event_email_id", event_email_id)
        .eq("status", "sent");

      const sentIds = new Set((alreadySent || []).map(s => s.registration_id));
      const toSend = registrations.filter(r => !sentIds.has(r.id));

      if (toSend.length === 0) {
        return new Response(
          JSON.stringify({ status: "all_already_sent", sent: 0, failed: 0, total: registrations.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      let sent = 0;
      let failed = 0;
      const errors: any[] = [];

      for (const reg of toSend) {
        const result = await enqueueOne(reg);
        if (result.status === "sent") sent++;
        else {
          failed++;
          errors.push(result);
        }
      }

      // Update sent_at on template
      await supabaseAdmin
        .from("event_emails")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", event_email_id);

      return new Response(
        JSON.stringify({ status: "bulk_completed", sent, failed, total: registrations.length, errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    throw new Error(`Unknown mode: ${mode}`);
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
