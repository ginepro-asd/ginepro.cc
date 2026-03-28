import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveEventPrice } from "../_shared/event-pricing.ts";
import { validateSpotsAndCertificate } from "../_shared/spot-validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SATISPAY_BASE_DEFAULT = "https://muvat-api-304633219729.europe-west1.run.app/payment/77jc79juc3ftimn93si6irl7k32f1n4sarj58oaugdn882rrqjn909m103nrc4ni634q61996p2cd6kilnor1qekraul4go906nlsfn6rse5thlf72oid48rki1fdqvm3qdkp6kjild2jgasolb2o0088op20a11od4kjtmtr4eu9hbfdtlj3poornpt7m9cvgmcqrd8";
const SATISPAY_TOKEN_DEFAULT = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjM3MzAwNzY5YTA3ZTA1MTE2ZjdlNTEzOGZhOTA5MzY4NWVlYmMyNDAiLCJ0eXAiOiJKV1QifQ.eyJ0ZW5hbnRJZCI6ImRvbWVuaWNvLTE3NzM5NTE3NzkxMzIiLCJyb2xlIjoiYWRtaW4iLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vc2F0aXNwYXktZ3ciLCJhdWQiOiJzYXRpc3BheS1ndyIsImF1dGhfdGltZSI6MTc3NDM2NDYxMywidXNlcl9pZCI6IlpwRzhOTEdjNjVhUXlPSVVTV3QwU0pDVk1LQjMiLCJzdWIiOiJacEc4TkxHYzY1YVF5T0lVU1d0MFNKQ1ZNS0IzIiwiaWF0IjoxNzc0Njc1NTU1LCJleHAiOjE3NzQ2NzkxNTUsImVtYWlsIjoiZG9tZS5kaWlvcmlvQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJkb21lLmRpaW9yaW9AZ21haWwuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifX0.DZ3aCqIuNleEzlLu7M455NKHogLzaHlL73dW45G73rKUPm6tQYzkiUaZh4VZ-hfwnK6WiDS6ucmV8wCzBQMgayvxBvHU77OLcGnnZa4aiGf0hVSysXHvogkA4CTaDAaPr8t6SWEj1bn3-53cBpotFwzJV8Vg83OIHK-a-ghvrX7LCS9pQFicvVN_mnvKJi7VT-Sa7ugg4gx8uEKr-9NK84C25IcQsBLeqGuWjW-8UwNDOoJZ_Iw3VP3S8fHo0fLmli0daZ42Avl4DQId_ECqf9NFg0eLV_EV1JB6xe8kvu7CUYqO42mEUM5yqq0a0QJAONBo9fJCmUv6Y5L_SGfbfg";

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
    const satispayBaseUrl = event.satispay_api_url || SATISPAY_BASE_DEFAULT;
    const satispayToken = event.satispay_api_token || SATISPAY_TOKEN_DEFAULT;
    const satispayHeaders: Record<string, string> = { "Content-Type": "application/json" };
    satispayHeaders["Authorization"] = `Bearer ${satispayToken}`;
    const res = await fetch(satispayBaseUrl, {
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