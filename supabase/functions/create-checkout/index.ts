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
    const {
      nome,
      cognome,
      email,
      telefono,
      identificationType,
      birthDate,
      birthPlace,
      codiceFiscale,
    } = await req.json();

    // Validate required fields
    if (!nome || !cognome || !email || !telefono || !identificationType) {
      throw new Error("Campi obbligatori mancanti");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Save registration with pending status
    const { data: registration, error: dbError } = await supabaseAdmin
      .from("registrations")
      .insert({
        nome,
        cognome,
        email,
        telefono,
        identification_type: identificationType,
        birth_date: birthDate || null,
        birth_place: birthPlace || null,
        codice_fiscale: codiceFiscale || null,
        payment_method: "stripe",
        payment_status: "pending",
      })
      .select("id")
      .single();

    if (dbError) throw new Error(`Database error: ${dbError.message}`);

    // Create Stripe checkout session
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    const origin = req.headers.get("origin") || "https://tredoziotrail.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: "Tredozio Trail 2027 - Early Bird" },
            unit_amount: 1499,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/conferma?registration_id=${registration.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?cancelled=true`,
      metadata: {
        registration_id: registration.id,
      },
    });

    // Store the Stripe session ID
    await supabaseAdmin
      .from("registrations")
      .update({ payment_id: session.id })
      .eq("id", registration.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
