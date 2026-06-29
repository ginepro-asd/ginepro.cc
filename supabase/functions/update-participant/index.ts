import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isValidAdminPassword } from "../_shared/admin-password.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, participant_id, fields } = await req.json();

    if (!isValidAdminPassword(password)) {
      return new Response(JSON.stringify({ error: "Password non valida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!participant_id || !fields || typeof fields !== "object") {
      return new Response(JSON.stringify({ error: "participant_id e fields sono obbligatori" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Only allow updating known safe fields
    const allowedFields = [
      "nome", "cognome", "email", "telefono", "codice_fiscale",
      "birth_date", "birth_place", "identification_type",
      "newsletter", "photo_url", "photo_thumb_url", "signature_url",
    ];
    const updateData: Record<string, any> = {};
    for (const key of allowedFields) {
      if (fields[key] !== undefined) {
        if (key === "newsletter") {
          updateData[key] = !!fields[key];
        } else {
          updateData[key] = fields[key] === "" ? null : fields[key];
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ error: "Nessun campo valido da aggiornare" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update participant
    const { error: updateErr } = await supabase
      .from("participants")
      .update(updateData)
      .eq("id", participant_id);

    if (updateErr) throw updateErr;

    // Also update matching registrations so they stay in sync
    const regUpdate: Record<string, any> = {};
    const regFields = ["nome", "cognome", "email", "telefono", "codice_fiscale", "birth_date", "birth_place", "identification_type"];
    for (const key of regFields) {
      if (updateData[key] !== undefined) {
        regUpdate[key] = updateData[key];
      }
    }

    if (Object.keys(regUpdate).length > 0) {
      await supabase
        .from("registrations")
        .update(regUpdate)
        .eq("participant_id", participant_id);
    }

    return new Response(
      JSON.stringify({ success: true, updated_fields: Object.keys(updateData) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
