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

    if (action === "create_participant") {
      const { participant } = body;
      if (!participant?.nome || !participant?.cognome || !participant?.email || !participant?.telefono) {
        return new Response(JSON.stringify({ error: "nome, cognome, email e telefono sono obbligatori" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const insertData: Record<string, any> = {
        nome: participant.nome,
        cognome: participant.cognome,
        email: participant.email,
        telefono: participant.telefono,
        identification_type: participant.identification_type || "birth",
        newsletter: participant.newsletter !== undefined ? participant.newsletter : true,
      };
      if (participant.codice_fiscale) insertData.codice_fiscale = participant.codice_fiscale;
      if (participant.birth_date) insertData.birth_date = participant.birth_date;
      if (participant.birth_place) insertData.birth_place = participant.birth_place;

      const { data, error } = await supabase
        .from("participants")
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, participant: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "admin_register") {
      const { participant_id, event_id, payment_method, custom_data } = body;
      if (!participant_id || !event_id) {
        return new Response(JSON.stringify({ error: "participant_id e event_id sono obbligatori" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get participant data
      const { data: part, error: partErr } = await supabase
        .from("participants")
        .select("*")
        .eq("id", participant_id)
        .single();
      if (partErr) throw partErr;

      // Delete any existing pending registration for same participant+event
      await supabase
        .from("registrations")
        .delete()
        .eq("participant_id", participant_id)
        .eq("event_id", event_id)
        .eq("payment_status", "pending");

      const regData = {
        participant_id,
        event_id,
        nome: part.nome,
        cognome: part.cognome,
        email: part.email,
        telefono: part.telefono,
        codice_fiscale: part.codice_fiscale || null,
        birth_date: part.birth_date || null,
        birth_place: part.birth_place || null,
        identification_type: part.identification_type || "birth",
        payment_method: payment_method || "admin",
        payment_status: "completed",
        custom_data: custom_data || {},
      };

      const { data, error } = await supabase
        .from("registrations")
        .insert(regData)
        .select()
        .single();
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, registration: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_registration") {
      const { registration_id, fields: regFields } = body;
      if (!registration_id || !regFields) {
        return new Response(JSON.stringify({ error: "registration_id e fields sono obbligatori" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const allowed = ["payment_status", "payment_method", "custom_data"];
      const sanitized: Record<string, any> = {};
      for (const [key, val] of Object.entries(regFields)) {
        if (allowed.includes(key)) sanitized[key] = val;
      }

      const { data, error } = await supabase
        .from("registrations")
        .update(sanitized)
        .eq("id", registration_id)
        .select()
        .single();
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, registration: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upsert_newsletter") {
      const { newsletter } = body;
      if (!newsletter?.slug || !newsletter?.subject) {
        return new Response(JSON.stringify({ error: "slug e subject sono obbligatori" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (newsletter.id) {
        const { data, error } = await supabase
          .from("newsletters")
          .update({
            slug: newsletter.slug,
            subject: newsletter.subject,
            cta_url: newsletter.cta_url,
            body_html: newsletter.body_html,
          })
          .eq("id", newsletter.id)
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, newsletter: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const { data, error } = await supabase
          .from("newsletters")
          .insert({
            slug: newsletter.slug,
            subject: newsletter.subject,
            cta_url: newsletter.cta_url,
            body_html: newsletter.body_html,
          })
          .select()
          .single();
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, newsletter: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
