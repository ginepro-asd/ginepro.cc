import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, format, event_id } = await req.json();

    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!password || password !== adminPassword) {
      return new Response(JSON.stringify({ error: "Password non valida" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Query registrations with linked event + participant metadata in one request
    let registrationsQuery = supabaseAdmin
      .from("registrations")
      .select("*, events(nome, slug), participants(id, nome, cognome, email, telefono, codice_fiscale, birth_date, birth_place)")
      .order("created_at", { ascending: false });

    if (event_id) {
      registrationsQuery = registrationsQuery.eq("event_id", event_id);
    }

    const { data: registrations, error } = await registrationsQuery;
    if (error) throw new Error(error.message);

    // Flatten event info and keep canonical participant payload from relationship
    const enriched = (registrations || []).map((r: any) => ({
      ...r,
      event_nome: r.events?.nome || "—",
      event_slug: r.events?.slug || "",
      canonical_participant: r.participants || null,
    }));

    // Group by participant_id (fallback to normalized email) for the admin view
    const participantMap: Record<string, any> = {};
    for (const r of enriched) {
      const canonical = r.canonical_participant;
      const key = r.participant_id || (canonical?.email || r.email).toLowerCase().trim();

      if (!participantMap[key]) {
        participantMap[key] = {
          email: canonical?.email ?? r.email,
          nome: canonical?.nome ?? r.nome,
          cognome: canonical?.cognome ?? r.cognome,
          telefono: canonical?.telefono ?? r.telefono,
          codice_fiscale: canonical?.codice_fiscale ?? r.codice_fiscale,
          birth_date: canonical?.birth_date ?? r.birth_date,
          birth_place: canonical?.birth_place ?? r.birth_place,
          participant_id: r.participant_id || null,
          registrations: [],
        };
      }

      participantMap[key].registrations.push({
        id: r.id,
        event_id: r.event_id,
        event_nome: r.event_nome,
        event_slug: r.event_slug,
        payment_method: r.payment_method,
        payment_status: r.payment_status,
        payment_id: r.payment_id,
        custom_data: r.custom_data,
        created_at: r.created_at,
      });
    }

    const participants = Object.values(participantMap);

    if (format === "csv") {
      const headers = [
        "id", "nome", "cognome", "email", "telefono",
        "identification_type", "codice_fiscale", "birth_date", "birth_place",
        "payment_method", "payment_status", "payment_id", "event_nome", "custom_data", "created_at",
      ];

      const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return "";
        const str = typeof val === "object" ? JSON.stringify(val) : String(val);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csv = [
        headers.join(","),
        ...enriched.map((r: any) =>
          headers.map((h) => escapeCSV(r[h])).join(",")
        ),
      ].join("\n");

      return new Response(csv, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="iscrizioni_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ registrations: enriched, participants }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
