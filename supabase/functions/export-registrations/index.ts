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

    let query = supabaseAdmin
      .from("registrations")
      .select("*")
      .order("created_at", { ascending: false });

    if (event_id) {
      query = query.eq("event_id", event_id);
    }

    const { data: registrations, error } = await query;

    if (error) throw new Error(error.message);

    if (format === "csv") {
      const headers = [
        "id", "nome", "cognome", "email", "telefono",
        "identification_type", "codice_fiscale", "birth_date", "birth_place",
        "payment_method", "payment_status", "payment_id", "event_id", "custom_data", "created_at",
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
        ...(registrations || []).map((r: any) =>
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

    return new Response(JSON.stringify({ registrations }), {
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
