import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";
import { resolveEventPrice } from "../_shared/event-pricing.ts";

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
      eventId, customData,
    } = await req.json();

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
      .select("id, nome, prezzo, slug, custom_fields")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Evento non trovato");

    const eventPrice = resolveEventPrice(event.prezzo, event.custom_fields, customData || {});
    const priceEur = (eventPrice / 100).toFixed(2);

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
      })
      .select("id")
      .single();

    if (dbError) throw new Error(`Database error: ${dbError.message}`);

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
              return_url: `${origin}/${event.slug}/conferma?registration_id=${registration.id}&provider=paypal`,
              cancel_url: `${origin}/${event.slug}?cancelled=true`,
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
