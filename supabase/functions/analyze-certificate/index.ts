import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { fileBase64, fileName, mimeType, expectedDiscipline } = await req.json();

    if (!fileBase64) {
      throw new Error("File mancante");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isImage = mimeType?.startsWith("image/");
    const isPdf = mimeType === "application/pdf" || fileName?.endsWith(".pdf");

    const systemPrompt = `Sei un assistente che analizza certificati medici sportivi italiani. 
Devi estrarre:
1. La data di scadenza del certificato
2. Le discipline sportive indicate (es. atletica leggera, ciclismo, nuoto, ecc.)
3. Il nome dell'atleta se visibile

Se non riesci a leggere chiaramente i dati, indica cosa non è leggibile.
Se la disciplina richiesta (${expectedDiscipline}) NON è presente nel certificato, segnalalo come warning.`;

    const userContent: any[] = [
      {
        type: "text",
        text: `Analizza questo certificato medico sportivo. La disciplina attesa è: "${expectedDiscipline}". Estrai data di scadenza e discipline indicate.`,
      },
    ];

    if (isImage) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${fileBase64}` },
      });
    } else if (isPdf) {
      userContent.push({
        type: "text",
        text: `[Contenuto del file PDF "${fileName}" in base64 — impossibile visualizzare direttamente. Analizza i dati disponibili dal contesto.]`,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_certificate_data",
              description: "Estrai i dati strutturati dal certificato medico.",
              parameters: {
                type: "object",
                properties: {
                  expiry_date: {
                    type: "string",
                    description: "Data di scadenza in formato YYYY-MM-DD. Null se non trovata.",
                  },
                  disciplines: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lista delle discipline sportive indicate nel certificato (es. 'atletica leggera', 'ciclismo').",
                  },
                  athlete_name: {
                    type: "string",
                    description: "Nome dell'atleta se visibile nel certificato.",
                  },
                  warning: {
                    type: "string",
                    description: "Eventuali warning, ad esempio se la disciplina attesa non è presente o se il certificato è scaduto. Null se tutto ok.",
                  },
                },
                required: ["expiry_date", "disciplines"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_certificate_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Troppi tentativi, riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("Errore nell'analisi AI");
    }

    const result = await response.json();

    // Extract tool call result
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const extracted = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(extracted), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback: return raw content
    return new Response(
      JSON.stringify({
        warning: "Analisi non strutturata. Verifica manualmente.",
        raw: result.choices?.[0]?.message?.content || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("analyze-certificate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
