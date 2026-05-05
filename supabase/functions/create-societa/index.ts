import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const nomeRaw = typeof body?.nome === "string" ? body.nome.trim() : "";
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : null;
    if (nomeRaw.length < 2 || nomeRaw.length > 120) {
      return new Response(JSON.stringify({ error: "Nome non valido (2-120 caratteri)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Compact whitespace
    const nome = nomeRaw.replace(/\s+/g, " ");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Dedup case-insensitive
    const { data: existing } = await supabase
      .from("societa")
      .select("*")
      .ilike("nome", nome)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ success: true, societa: existing, existed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("societa")
      .insert({ nome, note })
      .select()
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, societa: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
