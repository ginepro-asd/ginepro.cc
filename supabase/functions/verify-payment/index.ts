import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, registration_id } = await req.json();

    if (!session_id || !registration_id) {
      throw new Error("Missing session_id or registration_id");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (session.payment_status === "paid") {
      // Update the main registration
      await supabaseAdmin
        .from("registrations")
        .update({ payment_status: "completed", payment_id: session_id })
        .eq("id", registration_id);

      // Also update any paired registration sharing the same payment_id
      await supabaseAdmin
        .from("registrations")
        .update({ payment_status: "completed" })
        .eq("payment_id", session_id)
        .neq("id", registration_id);

      // Fetch registration data with event info for confirmation
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
            }
          );
          if (!emailRes.ok) {
            const errText = await emailRes.text();
            console.error("Email send failed:", errText);
          }
        } catch (emailErr) {
          console.error("Email send error:", emailErr.message);
        }
      }

      return new Response(
        JSON.stringify({ status: "completed", registration }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ status: session.payment_status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
