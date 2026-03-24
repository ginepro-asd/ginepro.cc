import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { createMembershipCardIfNeeded } from "../_shared/membership-card.ts";

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

      // Create membership card if tesseramento
      const card = await createMembershipCardIfNeeded(supabaseAdmin, registration_id);

      // Fetch registration data with event info for confirmation
      const { data: registration } = await supabaseAdmin
        .from("registrations")
        .select("nome, cognome, email, payment_method, event_id")
        .eq("id", registration_id)
        .single();

      // Send confirmation email via send-event-email (fire-and-forget)
      if (registration) {
        try {
          // Find the on_payment template for this event
          if (registration.event_id) {
            const { data: emailTemplate } = await supabaseAdmin
              .from("event_emails")
              .select("id")
              .eq("event_id", registration.event_id)
              .eq("trigger_type", "on_payment")
              .maybeSingle();

            if (emailTemplate) {
              const emailRes = await fetch(
                `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-event-email`,
                {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    event_email_id: emailTemplate.id,
                    registration_id,
                    mode: "single",
                  }),
                }
              );
              if (!emailRes.ok) {
                console.error("Event email send failed:", await emailRes.text());
              }
            } else {
              // Fallback to old send-confirmation-email
              let event = null;
              const { data: eventData } = await supabaseAdmin
                .from("events")
                .select("nome, data_evento, luogo, is_tesseramento")
                .eq("id", registration.event_id)
                .single();
              event = eventData;

              await fetch(
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
                    card: card ? { id: card.id, card_number: card.card_number } : null,
                    participant_id: registration.participant_id,
                  }),
                }
              );
            }
          }
        } catch (emailErr) {
          console.error("Email send error:", emailErr.message);
        }
      }

      return new Response(
        JSON.stringify({ status: "completed", registration, card }),
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
