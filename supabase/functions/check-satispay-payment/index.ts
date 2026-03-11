import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const XPAY_BASE = "https://xpay.ginepro.cc";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id, registration_id } = await req.json();

    if (!payment_id || !registration_id) {
      throw new Error("Missing payment_id or registration_id");
    }

    // Check payment state via xpay service
    const res = await fetch(`${XPAY_BASE}/paymentState/${payment_id}`);

    if (!res.ok) {
      const errText = await res.text();
      console.error("xpay check error:", res.status, errText);
      throw new Error(`xpay error: ${res.status}`);
    }

    const payment = await res.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (payment.status === "ACCEPTED") {
      await supabaseAdmin
        .from("registrations")
        .update({ payment_status: "completed" })
        .eq("id", registration_id);

      const { data: registration } = await supabaseAdmin
        .from("registrations")
        .select("nome, cognome, email, payment_method, event_id")
        .eq("id", registration_id)
        .single();

      // Send confirmation email (fire-and-forget)
      if (registration) {
        try {
          let event = null;
          if (registration.event_id) {
            const { data: eventData } = await supabaseAdmin
              .from("events")
              .select("nome, data_evento, luogo")
              .eq("id", registration.event_id)
              .single();
            event = eventData;
          }

          const emailRes = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-confirmation-email`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                nome: registration.nome,
                cognome: registration.cognome,
                email: registration.email,
                payment_method: registration.payment_method,
                registration_id,
                event,
              }),
            },
          );
          if (!emailRes.ok) {
            console.error("Email send failed:", await emailRes.text());
          }
        } catch (emailErr) {
          console.error("Email send error:", emailErr.message);
        }
      }

      return new Response(
        JSON.stringify({ status: "completed", registration }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (payment.status === "CANCELED") {
      await supabaseAdmin
        .from("registrations")
        .update({ payment_status: "cancelled" })
        .eq("id", registration_id);

      return new Response(
        JSON.stringify({ status: "cancelled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Still pending
    return new Response(
      JSON.stringify({ status: "pending" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
