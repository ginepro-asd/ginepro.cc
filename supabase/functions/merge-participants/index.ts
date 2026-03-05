import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { password, keep_id, merge_id, resolved_fields } = await req.json();

    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!password || password !== adminPassword) {
      return new Response(JSON.stringify({ error: "Password non valida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!keep_id || !merge_id) {
      return new Response(JSON.stringify({ error: "keep_id e merge_id sono obbligatori" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch both participants
    const { data: keepPart, error: e1 } = await supabase
      .from("participants")
      .select("*")
      .eq("id", keep_id)
      .single();

    const { data: mergePart, error: e2 } = await supabase
      .from("participants")
      .select("*")
      .eq("id", merge_id)
      .single();

    if (e1 || e2 || !keepPart || !mergePart) {
      return new Response(JSON.stringify({ error: "Partecipanti non trovati" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build merged fields: keep non-null, apply resolved_fields overrides
    const mergeableFields = ["nome", "cognome", "email", "telefono", "codice_fiscale", "birth_date", "birth_place", "identification_type"];
    const updateData: Record<string, any> = {};

    for (const field of mergeableFields) {
      if (resolved_fields && resolved_fields[field] !== undefined) {
        // User resolved conflict
        updateData[field] = resolved_fields[field];
      } else if (keepPart[field] == null && mergePart[field] != null) {
        // Fill from merge source
        updateData[field] = mergePart[field];
      }
      // else keep existing value
    }

    // Move all registrations from merge_id to keep_id
    // But skip if the same event already has a registration for keep_id
    const { data: keepRegs } = await supabase
      .from("registrations")
      .select("event_id")
      .eq("participant_id", keep_id);

    const keepEventIds = new Set((keepRegs || []).map(r => r.event_id));

    const { data: mergeRegs } = await supabase
      .from("registrations")
      .select("id, event_id")
      .eq("participant_id", merge_id);

    let movedCount = 0;
    for (const reg of mergeRegs || []) {
      if (!keepEventIds.has(reg.event_id)) {
        await supabase
          .from("registrations")
          .update({ participant_id: keep_id })
          .eq("id", reg.id);
        movedCount++;
      }
    }

    // Delete remaining registrations (duplicates) for merge participant
    await supabase
      .from("registrations")
      .delete()
      .eq("participant_id", merge_id);

    // Delete the merged participant BEFORE updating kept one (to avoid unique constraint on email)
    await supabase
      .from("participants")
      .delete()
      .eq("id", merge_id);

    // Now update kept participant with merged data
    if (Object.keys(updateData).length > 0) {
      const { error: updateErr } = await supabase
        .from("participants")
        .update(updateData)
        .eq("id", keep_id);
      if (updateErr) throw updateErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        moved_registrations: movedCount,
        merged_fields: Object.keys(updateData),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
