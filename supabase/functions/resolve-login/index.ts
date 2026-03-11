import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { identifier } = await req.json();

    if (!identifier) {
      throw new Error("Inserisci un identificativo");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const trimmed = identifier.trim().toLowerCase();

    // Try as email first
    if (trimmed.includes("@")) {
      return new Response(
        JSON.stringify({ email: trimmed }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try as card number (e.g. 2026-001)
    if (/^\d{4}-\d+$/.test(trimmed)) {
      const { data: card } = await supabaseAdmin
        .from("membership_cards")
        .select("participant_id")
        .eq("card_number", trimmed.toUpperCase())
        .single();

      if (card) {
        const { data: participant } = await supabaseAdmin
          .from("participants")
          .select("email")
          .eq("id", card.participant_id)
          .single();

        if (participant) {
          return new Response(
            JSON.stringify({ email: participant.email }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Try as phone number
    const { data: byPhone } = await supabaseAdmin
      .from("participants")
      .select("email, auth_user_id")
      .eq("telefono", trimmed)
      .not("auth_user_id", "is", null)
      .limit(1);

    if (byPhone && byPhone.length > 0) {
      return new Response(
        JSON.stringify({ email: byPhone[0].email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Nessun account trovato con questo identificativo");
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
