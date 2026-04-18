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
        "external_url", "regulation_url", "satispay_api_url", "satispay_api_token",
        "service_fee", "chiusura_ore_prima",
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
      if (error) {
        // If duplicate, try to find and return existing participant
        if (error.code === "23505") {
          const { data: existing } = await supabase
            .from("participants")
            .select("*")
            .or(`email.ilike.${participant.email},and(nome.ilike.${participant.nome},cognome.ilike.${participant.cognome})`)
            .limit(1)
            .single();
          if (existing) {
            return new Response(JSON.stringify({ success: true, participant: existing }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        throw error;
      }

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

      // Check for existing completed registration
      const { data: existingReg } = await supabase
        .from("registrations")
        .select("id")
        .eq("participant_id", participant_id)
        .eq("event_id", event_id)
        .eq("payment_status", "completed")
        .limit(1);

      if (existingReg && existingReg.length > 0) {
        return new Response(JSON.stringify({ error: "Già iscritto a questo evento" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

    if (action === "admin_satispay") {
      const { participant_id, event_id, custom_data } = body;
      if (!participant_id || !event_id) {
        return new Response(JSON.stringify({ error: "participant_id e event_id sono obbligatori" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: part, error: partErr } = await supabase
        .from("participants")
        .select("*")
        .eq("id", participant_id)
        .single();
      if (partErr) throw partErr;

      const { data: evt, error: evtErr } = await supabase
        .from("events")
        .select("id, nome, prezzo, custom_fields")
        .eq("id", event_id)
        .single();
      if (evtErr) throw evtErr;

      // Resolve price
      const { resolveEventPrice } = await import("../_shared/event-pricing.ts");
      const price = resolveEventPrice(evt.prezzo, evt.custom_fields, custom_data || {});

      // Delete any existing pending registration
      await supabase
        .from("registrations")
        .delete()
        .eq("participant_id", participant_id)
        .eq("event_id", event_id)
        .eq("payment_status", "pending");

      const { data: reg, error: regErr } = await supabase
        .from("registrations")
        .insert({
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
          payment_method: "satispay",
          payment_status: "pending",
          custom_data: custom_data || {},
        })
        .select("id")
        .single();
      if (regErr) throw regErr;

      // Call xpay
      const XPAY_BASE = "https://xpay.ginepro.cc";
      const orderId = `${evt.nome} ${part.cognome} ${part.nome}`;
      const xpayRes = await fetch(`${XPAY_BASE}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          phoneNumber: part.telefono,
          price,
        }),
      });

      if (!xpayRes.ok) {
        const errText = await xpayRes.text();
        // Clean up the pending registration
        await supabase.from("registrations").delete().eq("id", reg.id);
        throw new Error(`Satispay error: ${xpayRes.status} - ${errText}`);
      }

      const { paymentId } = await xpayRes.json();
      await supabase
        .from("registrations")
        .update({ payment_id: paymentId })
        .eq("id", reg.id);

      return new Response(JSON.stringify({
        success: true,
        payment_id: paymentId,
        registration_id: reg.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resend_satispay") {
      const { registration_id } = body;
      if (!registration_id) {
        return new Response(JSON.stringify({ error: "registration_id è obbligatorio" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: reg, error: regErr } = await supabase
        .from("registrations")
        .select("*, participants(*), events:event_id(id, nome, prezzo, custom_fields)")
        .eq("id", registration_id)
        .single();
      if (regErr) throw regErr;

      const part = reg.participants;
      const evt = reg.events;
      if (!part || !evt) throw new Error("Dati partecipante o evento mancanti");

      const { resolveEventPrice } = await import("../_shared/event-pricing.ts");
      const price = resolveEventPrice(evt.prezzo, evt.custom_fields, reg.custom_data || {});

      const XPAY_BASE = "https://xpay.ginepro.cc";
      const orderId = `${evt.nome} ${part.cognome} ${part.nome}`;
      const xpayRes = await fetch(`${XPAY_BASE}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          phoneNumber: part.telefono,
          price,
        }),
      });

      if (!xpayRes.ok) {
        const errText = await xpayRes.text();
        throw new Error(`Satispay error: ${xpayRes.status} - ${errText}`);
      }

      const { paymentId } = await xpayRes.json();
      await supabase
        .from("registrations")
        .update({ payment_id: paymentId, payment_status: "pending" })
        .eq("id", registration_id);

      return new Response(JSON.stringify({
        success: true,
        payment_id: paymentId,
        registration_id,
      }), {
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

    if (action === "create_event_email") {
      const { event_id, slug, subject, body_html, trigger_type, orario_map } = body;
      if (!event_id || !slug || !subject) {
        return new Response(JSON.stringify({ error: "event_id, slug e subject sono obbligatori" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase.from("event_emails").insert({
        event_id, slug, subject, body_html: body_html || null,
        trigger_type: trigger_type || "manual", orario_map: orario_map || {},
      }).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, event_email: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_event_email") {
      const { event_email_id, slug, subject, body_html, trigger_type, orario_map } = body;
      if (!event_email_id) {
        return new Response(JSON.stringify({ error: "event_email_id è obbligatorio" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const updates: Record<string, any> = {};
      if (slug !== undefined) updates.slug = slug;
      if (subject !== undefined) updates.subject = subject;
      if (body_html !== undefined) updates.body_html = body_html;
      if (trigger_type !== undefined) updates.trigger_type = trigger_type;
      if (orario_map !== undefined) updates.orario_map = orario_map;

      const { data, error } = await supabase.from("event_emails").update(updates).eq("id", event_email_id).select().single();
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, event_email: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_event_email") {
      const { event_email_id } = body;
      if (!event_email_id) {
        return new Response(JSON.stringify({ error: "event_email_id è obbligatorio" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabase.from("event_emails").delete().eq("id", event_email_id);
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
