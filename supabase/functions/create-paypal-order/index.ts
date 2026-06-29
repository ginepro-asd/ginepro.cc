import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { resolveEventPrice } from "../_shared/event-pricing.ts";
import { validateSpotsAndCertificate } from "../_shared/spot-validation.ts";

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
    const {
      nome, cognome, email, telefono,
      identificationType, birthDate, birthPlace, codiceFiscale,
      eventId, customData, isTesseramento,
      // Tesseramento-specific fields
      photoUrl, photoThumbUrl, signatureUrl,
      certificatePaths, certificateAnalyses,
      adminToken,
      societaId, societaNome,
    } = await req.json();
    const adminTokenSuffix = adminToken === "gin" ? "&token=gin" : "";

    if (!nome || !cognome || !email || !telefono || !identificationType || !eventId) {
      throw new Error("Campi obbligatori mancanti");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch event for pricing
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, nome, prezzo, slug, custom_fields, service_fee")
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
    const priceEur = (totalPrice / 100).toFixed(2);

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
    if (societaId) participantData.societa_id = societaId;

    const { data: existingByName } = await supabaseAdmin
      .from("participants")
      .select("id")
      .eq("nome", nome)
      .eq("cognome", cognome)
      .maybeSingle();

    let participant: { id: string };
    if (existingByName?.id) {
      const { data: updated, error: updErr } = await supabaseAdmin
        .from("participants")
        .update(participantData)
        .eq("id", existingByName.id)
        .select("id")
        .single();
      if (updErr) throw new Error(`Participant error: ${updErr.message}`);
      participant = updated;
    } else {
      const { data: inserted, error: partError } = await supabaseAdmin
        .from("participants")
        .insert(participantData)
        .select("id")
        .single();
      if (partError) throw new Error(`Participant error: ${partError.message}`);
      participant = inserted;
    }

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
        payment_method: "paypal",
        payment_status: "pending",
        event_id: eventId,
        custom_data: customData || {},
        societa_id: societaId || null,
        societa_nome: societaNome || null,
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

    const accessToken = await getAccessToken();
    const origin = req.headers.get("origin") || "https://tredoziotrail.lovable.app";

    const orderRes = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: registration.id,
            description: event.nome,
            amount: {
              currency_code: "EUR",
              value: priceEur,
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
              brand_name: `${event.nome} by GINEPRO`,
              locale: "it-IT",
              user_action: "PAY_NOW",
              return_url: `${origin}/${event.slug}/conferma?registration_id=${registration.id}&provider=paypal${adminTokenSuffix}`,
              cancel_url: `${origin}/${event.slug}?cancelled=true${adminTokenSuffix}`,
            },
          },
        },
      }),
    });

    if (!orderRes.ok) {
      const errText = await orderRes.text();
      console.error("PayPal order error:", orderRes.status, errText);
      throw new Error(`PayPal error: ${orderRes.status}`);
    }

    const order = await orderRes.json();

    await supabaseAdmin
      .from("registrations")
      .update({ payment_id: order.id })
      .eq("id", registration.id);

    const approveLink = order.links?.find((l: any) => l.rel === "payer-action" || l.rel === "approve");
    const approveUrl = approveLink?.href;

    if (!approveUrl) throw new Error("Nessun URL di approvazione PayPal ricevuto");

    return new Response(
      JSON.stringify({ url: approveUrl, order_id: order.id, registration_id: registration.id }),
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
