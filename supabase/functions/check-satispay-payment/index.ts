import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { createMembershipCardIfNeeded } from "../_shared/membership-card.ts";
import { sendRegistrationConfirmation } from "../_shared/send-registration-confirmation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SATISPAY_BASE_DEFAULT = "https://muvat-api-304633219729.europe-west1.run.app/payment/77jc79juc3ftimn93si6irl7k32f1n4sarj58oaugdn882rrqjn909m103nrc4ni634q61996p2cd6kilnor1qekraul4go906nlsfn6rse5thlf72oid48rki1fdqvm3qdkp6kjild2jgasolb2o0088op20a11od4kjtmtr4eu9hbfdtlj3poornpt7m9cvgmcqrd8";
const SATISPAY_TOKEN_DEFAULT = Deno.env.get("SATISPAY_MUVAT_TOKEN") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id, registration_id } = await req.json();

    if (!payment_id || !registration_id) {
      throw new Error("Missing payment_id or registration_id");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Look up the event's custom Satispay config via the registration
    const { data: regData } = await supabaseAdmin
      .from("registrations")
      .select("event_id")
      .eq("id", registration_id)
      .single();

    let satispayBaseUrl = SATISPAY_BASE_DEFAULT;
    let satispayToken = SATISPAY_TOKEN_DEFAULT;
    if (regData?.event_id) {
      const { data: eventData } = await supabaseAdmin
        .from("events")
        .select("satispay_api_url, satispay_api_token")
        .eq("id", regData.event_id)
        .single();
      if (eventData?.satispay_api_url) satispayBaseUrl = eventData.satispay_api_url;
      if (eventData?.satispay_api_token) satispayToken = eventData.satispay_api_token;
    }

    const checkHeaders: Record<string, string> = {
      "Authorization": `Bearer ${satispayToken}`,
    };
    const res = await fetch(`${satispayBaseUrl}/${payment_id}`, { headers: checkHeaders, method: "GET" });

    if (!res.ok) {
      const errText = await res.text();
      console.error("xpay check error:", res.status, errText);
      throw new Error(`xpay error: ${res.status}`);
    }

    const payment = await res.json();


    if (payment.status === "ACCEPTED") {
      // Update the main registration
      await supabaseAdmin
        .from("registrations")
        .update({ payment_status: "completed" })
        .eq("id", registration_id);

      // Also update any paired registration sharing the same payment_id
      await supabaseAdmin
        .from("registrations")
        .update({ payment_status: "completed" })
        .eq("payment_id", payment_id)
        .neq("id", registration_id);

      // Create membership card if tesseramento
      const card = await createMembershipCardIfNeeded(supabaseAdmin, registration_id);

      const registration = await sendRegistrationConfirmation(supabaseAdmin, registration_id, card);

      return new Response(
        JSON.stringify({ status: "completed", registration, card }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (payment.status === "CANCELED") {
      await supabaseAdmin
        .from("registrations")
        .update({ payment_status: "cancelled" })
        .eq("id", registration_id);

      // Also cancel any paired registration sharing the same payment_id
      await supabaseAdmin
        .from("registrations")
        .update({ payment_status: "cancelled" })
        .eq("payment_id", payment_id)
        .neq("id", registration_id);

      return new Response(
        JSON.stringify({ status: "cancelled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Still pending
    return new Response(
      JSON.stringify({ status: "pending" }),
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
