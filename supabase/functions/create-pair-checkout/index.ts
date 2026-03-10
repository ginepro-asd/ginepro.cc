import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encode as base64Encode } from "https://deno.land/std@0.190.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const XPAY_BASE = "https://xpay.ginepro.cc";
const PAYPAL_API_URL = "https://api-m.paypal.com";

async function getPayPalAccessToken(): Promise<string> {
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
  if (!res.ok) throw new Error(`PayPal auth error: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { participantA, participantB, paymentMethod, eventId, customData, disciplina } = await req.json();

    if (!participantA || !participantB || !paymentMethod || !eventId) {
      throw new Error("Campi obbligatori mancanti");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch event
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, nome, prezzo, slug, is_coppia, pettorale_start")
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Evento non trovato");
    if (!event.is_coppia) throw new Error("Questo evento non è una gara in coppia");

    // Determine unit price based on discipline
    const DISCIPLINE_PRICES: Record<string, number> = {
      "Staffetta": 800,
      "Eco-camminata": 500,
    };
    const unitPrice = disciplina && DISCIPLINE_PRICES[disciplina] ? DISCIPLINE_PRICES[disciplina] : event.prezzo;
    const totalPrice = unitPrice * 2;
    const pairId = crypto.randomUUID();

    // Determine next bib number
    const { data: existingRegs } = await supabaseAdmin
      .from("registrations")
      .select("custom_data")
      .eq("event_id", eventId);

    let maxBib = (event.pettorale_start || 100) - 1;
    if (existingRegs) {
      for (const r of existingRegs) {
        const cd = r.custom_data as Record<string, any> | null;
        if (cd?.pettorale_num && cd.pettorale_num > maxBib) {
          maxBib = cd.pettorale_num;
        }
      }
    }
    const bibNumber = maxBib + 1;
    const pettoraleA = `${bibNumber}A`;
    const pettoraleB = `${bibNumber}B`;

    // Helper to upsert participant and create registration
    async function createParticipantAndRegistration(
      p: any, pettorale: string, suffix: string
    ) {
      const { data: participant, error: partError } = await supabaseAdmin
        .from("participants")
        .upsert({
          nome: p.nome,
          cognome: p.cognome,
          email: p.email,
          telefono: p.telefono,
          codice_fiscale: p.codiceFiscale || null,
          birth_date: p.birthDate || null,
          birth_place: p.birthPlace || null,
          identification_type: p.identificationType,
        }, { onConflict: "email" })
        .select("id")
        .single();

      if (partError) throw new Error(`Participant ${suffix} error: ${partError.message}`);

      const regCustomData = {
        ...(customData || {}),
        pair_id: pairId,
        pettorale: pettorale,
        pettorale_num: bibNumber,
        pair_suffix: suffix,
      };

      const { data: registration, error: dbError } = await supabaseAdmin
        .from("registrations")
        .insert({
          participant_id: participant.id,
          nome: p.nome,
          cognome: p.cognome,
          email: p.email,
          telefono: p.telefono,
          identification_type: p.identificationType,
          birth_date: p.birthDate || null,
          birth_place: p.birthPlace || null,
          codice_fiscale: p.codiceFiscale || null,
          payment_method: paymentMethod,
          payment_status: "pending",
          event_id: eventId,
          custom_data: regCustomData,
        })
        .select("id")
        .single();

      if (dbError) throw new Error(`Registration ${suffix} error: ${dbError.message}`);
      return registration;
    }

    const regA = await createParticipantAndRegistration(participantA, pettoraleA, "A");
    const regB = await createParticipantAndRegistration(participantB, pettoraleB, "B");

    const origin = req.headers.get("origin") || "https://ginepro.lovable.app";

    // Handle payment methods
    if (paymentMethod === "stripe") {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
        apiVersion: "2025-08-27.basil",
      });

      const session = await stripe.checkout.sessions.create({
        customer_email: participantA.email,
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: { name: `${event.nome} — Coppia ${bibNumber}` },
              unit_amount: totalPrice,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/${event.slug}/conferma?registration_id=${regA.id}&session_id={CHECKOUT_SESSION_ID}&pair=true`,
        cancel_url: `${origin}/${event.slug}?cancelled=true`,
        metadata: { registration_id_a: regA.id, registration_id_b: regB.id, event_id: eventId, pair_id: pairId },
      });

      // Update both registrations with payment_id
      await supabaseAdmin.from("registrations").update({ payment_id: session.id }).eq("id", regA.id);
      await supabaseAdmin.from("registrations").update({ payment_id: session.id }).eq("id", regB.id);

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (paymentMethod === "satispay") {
      const orderId = `${event.nome} Coppia ${bibNumber}`;
      const res = await fetch(`${XPAY_BASE}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          phoneNumber: participantA.telefono,
          price: totalPrice,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Satispay error: ${res.status} - ${errText}`);
      }

      const { paymentId } = await res.json();
      await supabaseAdmin.from("registrations").update({ payment_id: paymentId }).eq("id", regA.id);
      await supabaseAdmin.from("registrations").update({ payment_id: paymentId }).eq("id", regB.id);

      return new Response(
        JSON.stringify({ payment_id: paymentId, registration_id: regA.id, pair: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (paymentMethod === "paypal") {
      const accessToken = await getPayPalAccessToken();
      const priceEur = (totalPrice / 100).toFixed(2);

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
              reference_id: regA.id,
              description: `${event.nome} — Coppia ${bibNumber}`,
              amount: { currency_code: "EUR", value: priceEur },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
                brand_name: `${event.nome} by GINEPRO`,
                locale: "it-IT",
                user_action: "PAY_NOW",
                return_url: `${origin}/${event.slug}/conferma?registration_id=${regA.id}&provider=paypal&pair=true`,
                cancel_url: `${origin}/${event.slug}?cancelled=true`,
              },
            },
          },
        }),
      });

      if (!orderRes.ok) throw new Error(`PayPal error: ${orderRes.status}`);

      const order = await orderRes.json();
      await supabaseAdmin.from("registrations").update({ payment_id: order.id }).eq("id", regA.id);
      await supabaseAdmin.from("registrations").update({ payment_id: order.id }).eq("id", regB.id);

      const approveLink = order.links?.find((l: any) => l.rel === "payer-action" || l.rel === "approve");
      if (!approveLink?.href) throw new Error("Nessun URL PayPal ricevuto");

      return new Response(
        JSON.stringify({ url: approveLink.href, order_id: order.id, registration_id: regA.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    throw new Error("Metodo di pagamento non supportato");
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
