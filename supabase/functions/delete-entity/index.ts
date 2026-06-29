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
    const { password, type, id } = await req.json();

    if (!isValidAdminPassword(password)) {
      return new Response(JSON.stringify({ error: "Password non valida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!type || !id) {
      return new Response(JSON.stringify({ error: "type e id sono obbligatori" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (type === "registration") {
      const { error } = await supabase.from("registrations").delete().eq("id", id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, deleted: "registration", id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "participant") {
      // Delete all registrations for this participant first
      const { data: regs, error: regListErr } = await supabase
        .from("registrations")
        .select("id")
        .eq("participant_id", id);
      if (regListErr) throw regListErr;

      const { error: regDelErr } = await supabase
        .from("registrations")
        .delete()
        .eq("participant_id", id);
      if (regDelErr) throw regDelErr;

      const { error: partDelErr } = await supabase
        .from("participants")
        .delete()
        .eq("id", id);
      if (partDelErr) throw partDelErr;

      return new Response(
        JSON.stringify({
          success: true,
          deleted: "participant",
          id,
          registrations_deleted: regs?.length || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "type deve essere 'registration' o 'participant'" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
