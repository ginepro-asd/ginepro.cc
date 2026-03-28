import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveEventPrice } from "../_shared/event-pricing.ts";
import { validateSpotsAndCertificate } from "../_shared/spot-validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const XPAY_BASE_DEFAULT = "https://xpay.ginepro.cc";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      nome, cognome, email, telefono,
      identificationType, birthDate, birthPlace, codiceFiscale,
      eventId, customData, isTesseramento,
      // Tesseramento-specific fields
      photoUrl, photoThumbUrl, signatureUrl,
      certificatePaths, certificateAnalyses,
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
      .select("id, nome, prezzo, slug, custom_fields, service_fee, satispay_api_url, satispay_api_token")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Evento non trovato");

    // Validate spots and certificate
    await validateSpotsAndCertificate(supabaseAdmin, event, customData || {}, certificatePaths);

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
    const totalPrice = eventPrice + (event.service_fee || 0);

    // Upsert participant (with photo/signature if provided)
    const participantData: any = {
      nome, cognome, email, telefono,
      codice_fiscale: codiceFiscale || null,
      birth_date: birthDate || null,
      birth_place: birthPlace || null,
      identification_type: identificationType,
    };
    if (photoUrl) participantData.photo_url = photoUrl;
    if (photoThumbUrl) participantData.photo_thumb_url = photoThumbUrl;
    if (signatureUrl) participantData.signature_url = signatureUrl;

    const { data: participant, error: partError } = await supabaseAdmin
      .from("participants")
      .upsert(participantData, { onConflict: "email" })
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

    // Save medical certificates if provided
    if (certificatePaths?.length > 0) {
      for (let i = 0; i < certificatePaths.length; i++) {
        const analysis = certificateAnalyses?.[i] || {};
        await supabaseAdmin.from("medical_certificates").insert({
          participant_id: participant.id,
          registration_id: registration.id,
          file_path: certificatePaths[i],
          expiry_date: analysis.expiryDate || null,
          disciplines: analysis.disciplines || [],
          ai_warning: analysis.warning || null,
        });
      }
    }

    const orderId = `${event.nome} ${cognome} ${nome}`;
    const satispayBaseUrl = event.satispay_api_url || XPAY_BASE_DEFAULT;
    const satispayHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (event.satispay_api_token) {
      satispayHeaders["Authorization"] = `Bearer ${event.satispay_api_token}`;
    }
    const res = await fetch(`${satispayBaseUrl}/payment`, {
      method: "POST",
      headers: satispayHeaders,
      body: JSON.stringify({
        orderId,
        phoneNumber: telefono,
        price: totalPrice,
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