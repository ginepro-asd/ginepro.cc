import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { createMembershipCardIfNeeded } from "../_shared/membership-card.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYPAL_API_URL = "https://api-m.paypal.com";

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID")!;
  const secretKey = Deno.env.get("PAYPAL_SECRET_KEY")!;
  const credentials = base64Encode(new TextEncoder().encode(`${clientId}:${secretKey}`));

  const res = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("PayPal token error:", res.status, errText);
    throw new Error(`PayPal auth error: ${res.status}`);
  }

  const data = await res.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, registration_id } = await req.json();

    if (!order_id || !registration_id) {
      throw new Error("Missing order_id or registration_id");
    }

    const accessToken = await getAccessToken();

    const captureRes = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders/${order_id}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!captureRes.ok) {
      const errText = await captureRes.text();
      console.error("PayPal capture error:", captureRes.status, errText);
      throw new Error(`PayPal capture error: ${captureRes.status}`);
    }

    const capture = await captureRes.json();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (capture.status === "COMPLETED") {
      await supabaseAdmin
        .from("registrations")
        .update({ payment_status: "completed", payment_id: order_id })
        .eq("id", registration_id);

      // Create membership card if tesseramento
      const card = await createMembershipCardIfNeeded(supabaseAdmin, registration_id);

      const { data: registration } = await supabaseAdmin
        .from("registrations")
        .select("nome, cognome, email, payment_method, event_id")
        .eq("id", registration_id)
        .single();

      // Send confirmation email via send-event-email (fire-and-forget)
      if (registration) {
        try {
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
      JSON.stringify({ status: capture.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
