import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
    const body = await req.json();
    const {
      nome,
      cognome,
      email,
      payment_method,
      paymentMethod,
      registration_id,
      participant_id,
      participantId,
      event,
      card,
    } = body;

    if (!email || !nome || !cognome) {
      throw new Error("Missing required fields: nome, cognome, email");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const response = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        templateName: "registration-confirmation",
        recipientEmail: email,
        idempotencyKey: `registration-confirmation-${registration_id || email}`,
        templateData: {
          nome,
          cognome,
          email,
          paymentMethod: paymentMethod || payment_method || null,
          event: event || null,
          card: card || null,
          participantId: participantId || participant_id || null,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Confirmation app email error:", errorText);
      throw new Error(`App email error: ${response.status}`);
    }

    return new Response(
      JSON.stringify({ success: true, queued: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("Error sending email:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
