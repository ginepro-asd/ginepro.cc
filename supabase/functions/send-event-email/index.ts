import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_URL = "https://api.resend.com/emails";

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
    // mode: "single" (default) | "bulk" | "test"

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

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const orarioMap: Record<string, string> = template.orario_map || {};

    // Helper to send a single email
    const sendOne = async (reg: any): Promise<{ registration_id: string; status: string; error?: string }> => {
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

      try {
        const res = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Ginepro ASD <info@ginepro.cc>",
            to: [reg.email],
            subject,
            html: htmlBody,
          }),
        });

        const result = await res.json();
        if (!res.ok) {
          console.error("Resend error:", res.status, JSON.stringify(result));
          // Log failure
          await supabaseAdmin.from("event_email_sends").upsert({
            event_email_id,
            registration_id: reg.id,
            status: "failed",
            error: JSON.stringify(result),
          }, { onConflict: "event_email_id,registration_id" });
          return { registration_id: reg.id, status: "failed", error: JSON.stringify(result) };
        }

        // Log success
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

      const htmlBody = resolveTemplate(template.body_html || "", {
        nome: fakeReg.nome,
        cognome: fakeReg.cognome,
        email: fakeReg.email,
        orario: orarioMap[fakeReg.custom_data.disciplina] || "",
        disciplina: fakeReg.custom_data.disciplina,
        telefono: fakeReg.telefono,
      });
      const subject = resolveTemplate(template.subject || "", { nome: fakeReg.nome });

      const res = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Ginepro ASD <info@ginepro.cc>",
          to: [test_email],
          subject: `[TEST] ${subject}`,
          html: htmlBody,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(result)}`);

      return new Response(
        JSON.stringify({ status: "test_sent", email_id: result.id }),
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

      const result = await sendOne(reg);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // MODE: bulk — send to all completed registrations for the event
    if (mode === "bulk") {
      const targetEventId = event_id || template.event_id;
      if (!targetEventId) throw new Error("Missing event_id for bulk send");

      // Get all completed registrations
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

      // Send with small delay to respect rate limits
      for (const reg of toSend) {
        const result = await sendOne(reg);
        if (result.status === "sent") sent++;
        else {
          failed++;
          errors.push(result);
        }
        // Small delay between sends
        if (toSend.indexOf(reg) < toSend.length - 1) {
          await new Promise(r => setTimeout(r, 300));
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
