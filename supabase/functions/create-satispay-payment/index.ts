import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveEventPrice } from "../_shared/event-pricing.ts";

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
    const {
      nome, cognome, email, telefono,
      identificationType, birthDate, birthPlace, codiceFiscale,
      eventId, customData, isTesseramento,
    } = await req.json();

    if (!nome || !cognome || !email || !telefono || !identificationType || !eventId) {
      throw new Error("Campi obbligatori mancanti");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch event for pricing
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, nome, prezzo, slug, custom_fields")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Evento non trovato");

    // For tesseramento events, use membership type pricing
    const MEMBERSHIP_PRICES: Record<string, number> = {
      "fidal-running": 4000, "fidal-running-uisp-bike": 8000,
      "socio-sostenitore": 1500, "uisp-bike": 5500,
      "uisp-running": 2500, "uisp-running-bike": 6500,
    };
    const membershipType = customData?.membershipType;
    const eventPrice = (isTesseramento && membershipType && MEMBERSHIP_PRICES[membershipType])
      ? MEMBERSHIP_PRICES[membershipType]
      : resolveEventPrice(event.prezzo, event.custom_fields, customData || {});

    // Upsert participant
    const { data: participant, error: partError } = await supabaseAdmin
      .from("participants")
      .upsert({
        nome, cognome, email, telefono,
        codice_fiscale: codiceFiscale || null,
        birth_date: birthDate || null,
        birth_place: birthPlace || null,
        identification_type: identificationType,
      }, { onConflict: "email" })
      .select("id")
      .single();

    if (partError) throw new Error(`Participant error: ${partError.message}`);

    // Remove any existing non-completed registration for this participant+event
    await supabaseAdmin
      .from("registrations")
      .delete()
      .eq("participant_id", participant.id)
      .eq("event_id", eventId)
      .neq("payment_status", "completed");

    const { data: registration, error: dbError } = await supabaseAdmin
      .from("registrations")
      .insert({
        participant_id: participant.id,
        nome, cognome, email, telefono,
        identification_type: identificationType,
        birth_date: birthDate || null,
        birth_place: birthPlace || null,
        codice_fiscale: codiceFiscale || null,
        payment_method: "satispay",
        payment_status: "pending",
        event_id: eventId,
        custom_data: customData || {},
      })
      .select("id")
      .single();

    if (dbError) throw new Error(`Database error: ${dbError.message}`);

    const orderId = `${event.nome} ${cognome} ${nome}`;
    const res = await fetch(`${XPAY_BASE}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        phoneNumber: telefono,
        price: eventPrice,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("xpay error:", res.status, errText);
      throw new Error(`xpay error: ${res.status} - ${errText}`);
    }

    const { paymentId } = await res.json();

    await supabaseAdmin
      .from("registrations")
      .update({ payment_id: paymentId })
      .eq("id", registration.id);

    return new Response(
      JSON.stringify({ payment_id: paymentId, registration_id: registration.id }),
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
