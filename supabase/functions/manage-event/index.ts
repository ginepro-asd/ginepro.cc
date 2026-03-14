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
    const body = await req.json();
    const { password, action } = body;

    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!password || password !== adminPassword) {
      return new Response(JSON.stringify({ error: "Password non valida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (action === "list") {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ events: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const { event_id, fields } = body;
      if (!event_id || !fields) {
        return new Response(JSON.stringify({ error: "event_id e fields sono obbligatori" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Allowed fields
      const allowed = [
        "nome", "slug", "descrizione", "data_evento", "luogo", "prezzo",
        "scadenza_iscrizioni", "attivo", "hero_image", "payment_methods",
        "is_tesseramento", "is_coppia", "pettorale_start", "custom_fields",
        "location_lat", "location_lng", "location_label", "visibile_in_landing",
        "external_url", "regulation_url",
      ];
      const sanitized: Record<string, any> = {};
      for (const [key, val] of Object.entries(fields)) {
        if (allowed.includes(key)) sanitized[key] = val;
      }

      const { data, error } = await supabase
        .from("events")
        .update(sanitized)
        .eq("id", event_id)
        .select()
        .single();
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, event: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      const { fields } = body;
      if (!fields?.nome || !fields?.slug) {
        return new Response(JSON.stringify({ error: "nome e slug sono obbligatori" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("events")
        .insert(fields)
        .select()
        .single();
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, event: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { event_id } = body;
      if (!event_id) {
        return new Response(JSON.stringify({ error: "event_id è obbligatorio" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Count registrations
      const { data: regs } = await supabase
        .from("registrations")
        .select("id")
        .eq("event_id", event_id);

      if (regs && regs.length > 0) {
        return new Response(JSON.stringify({ 
          error: `Impossibile eliminare: ci sono ${regs.length} iscrizioni collegate. Elimina prima le iscrizioni.` 
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase.from("events").delete().eq("id", event_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Azione non valida" }), {
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
