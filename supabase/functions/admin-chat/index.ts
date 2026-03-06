import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "query_database",
      description:
        "Execute a read-only SQL query on the Supabase database. Tables: events (id, nome, slug, prezzo, attivo, is_tesseramento, data_evento, luogo, scadenza_iscrizioni, payment_methods, custom_fields, hero_image, descrizione, created_at, updated_at), participants (id, nome, cognome, email, telefono, codice_fiscale, birth_date, birth_place, identification_type, created_at, updated_at), registrations (id, event_id, participant_id, nome, cognome, email, telefono, codice_fiscale, birth_date, birth_place, identification_type, payment_method, payment_status, payment_id, custom_data, created_at, updated_at). Registrations has FK to events(id) and participants(id).",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "A read-only SQL SELECT query. No INSERT/UPDATE/DELETE/DROP/ALTER allowed.",
          },
        },
        required: ["sql"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modify_data",
      description:
        "Execute an INSERT, UPDATE or DELETE SQL statement on the database. Use this for data modifications. Tables and columns are the same as query_database. NEVER use DROP, ALTER, TRUNCATE or other DDL statements.",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "An INSERT, UPDATE or DELETE SQL statement. No DDL (DROP/ALTER/CREATE/TRUNCATE) allowed.",
          },
        },
        required: ["sql"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modify_schema",
      description:
        "Execute DDL SQL statements to modify the database schema (ALTER TABLE, CREATE TABLE, ADD COLUMN, etc.). Use with extreme caution. Only for adding/modifying columns and tables.",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "A DDL SQL statement. Allowed: ALTER TABLE ADD COLUMN, CREATE TABLE, CREATE INDEX. NOT allowed: DROP TABLE, DROP DATABASE, TRUNCATE.",
          },
        },
        required: ["sql"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_firestore_events",
      description: "List available events from the legacy Firestore database that can be imported.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "import_firestore_event",
      description: "Import a specific event from Firestore into the current database by its Firestore event ID.",
      parameters: {
        type: "object",
        properties: {
          firestore_event_id: {
            type: "string",
            description: "The Firestore event document ID to import.",
          },
        },
        required: ["firestore_event_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "firestore_list_collections",
      description: "List all top-level collections in Firestore. Returns collection IDs.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "firestore_list_documents",
      description: "List documents in a Firestore collection or subcollection. Use path like 'events' or 'events/myEventId/entries'.",
      parameters: {
        type: "object",
        properties: {
          collection_path: {
            type: "string",
            description: "The collection path, e.g. 'events', 'users', 'events/eventId/entries'.",
          },
          page_size: {
            type: "number",
            description: "Number of documents to return (default 20, max 100).",
          },
          page_token: {
            type: "string",
            description: "Token for pagination (from previous response).",
          },
        },
        required: ["collection_path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "firestore_get_document",
      description: "Get a single Firestore document by its full path, e.g. 'events/myEventId'.",
      parameters: {
        type: "object",
        properties: {
          document_path: {
            type: "string",
            description: "The document path, e.g. 'events/myEventId', 'users/userId'.",
          },
        },
        required: ["document_path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "firestore_list_subcollections",
      description: "List subcollections of a specific Firestore document, e.g. subcollections of 'events/myEventId'.",
      parameters: {
        type: "object",
        properties: {
          document_path: {
            type: "string",
            description: "The document path, e.g. 'events/myEventId'.",
          },
        },
        required: ["document_path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "firestore_write_document",
      description: "Create or update a Firestore document. Provide the collection path and document data. If document_id is provided, it updates/creates that specific doc; otherwise a new doc is auto-generated.",
      parameters: {
        type: "object",
        properties: {
          collection_path: {
            type: "string",
            description: "The collection path, e.g. 'events', 'users'.",
          },
          document_id: {
            type: "string",
            description: "Optional document ID. If omitted, Firestore auto-generates one.",
          },
          data: {
            type: "object",
            description: "The document data as key-value pairs. Values will be auto-typed (string, number, boolean).",
          },
        },
        required: ["collection_path", "data"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "firestore_delete_document",
      description: "Delete a Firestore document by its full path.",
      parameters: {
        type: "object",
        properties: {
          document_path: {
            type: "string",
            description: "The document path to delete, e.g. 'events/myEventId'.",
          },
        },
        required: ["document_path"],
        additionalProperties: false,
      },
    },
  },
];

const SYSTEM_PROMPT = `Sei un assistente admin per il sistema di gestione iscrizioni GINEPRO. Parla italiano.

Hai accesso a un database PostgreSQL con queste tabelle:
- **events**: eventi (id uuid, nome text, slug text, prezzo int centesimi, attivo bool, is_tesseramento bool, data_evento date, luogo text, scadenza_iscrizioni timestamptz, payment_methods text[], custom_fields jsonb, hero_image text, descrizione text)
- **participants**: anagrafica partecipanti (id uuid, nome text, cognome text, email text UNIQUE, telefono text, codice_fiscale text, birth_date date, birth_place text, identification_type text)
- **registrations**: iscrizioni (id uuid, event_id uuid FK events, participant_id uuid FK participants, nome, cognome, email, telefono, codice_fiscale, birth_date, birth_place, identification_type, payment_method text, payment_status text default 'pending', payment_id text, custom_data jsonb)

Hai anche accesso COMPLETO al database Firestore legacy:
- **firestore_list_collections**: elenca tutte le collezioni top-level
- **firestore_list_documents**: elenca documenti in una collezione (supporta path come 'events', 'events/id/entries')
- **firestore_get_document**: leggi un singolo documento per path
- **firestore_list_subcollections**: elenca sottocollezioni di un documento
- **firestore_write_document**: crea/aggiorna un documento in Firestore
- **firestore_delete_document**: elimina un documento da Firestore
- **list_firestore_events** e **import_firestore_event**: per importare eventi nel DB attuale

Regole importanti:
- Per le query di lettura usa query_database
- Per modificare dati (INSERT/UPDATE/DELETE) usa modify_data
- Per modificare lo schema (ALTER TABLE, CREATE TABLE) usa modify_schema — chiedi sempre conferma prima
- Per esplorare Firestore usa i tool firestore_*
- NON eseguire mai DROP TABLE, DROP DATABASE, TRUNCATE
- Formatta i risultati in modo leggibile con tabelle markdown quando possibile
- Per le statistiche, calcola aggregazioni direttamente in SQL
- Se non sei sicuro di un'operazione distruttiva, chiedi conferma all'utente`;

// Execute a SQL query using the Supabase client's rpc or direct REST
async function executeSql(supabase: any, sql: string, dbUrl: string): Promise<any> {
  // Use the REST API directly with the service role key for raw SQL
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({}),
  });

  // Fallback: use the database URL directly
  // We'll use the pg wire protocol via Deno's postgres
  // Actually let's just use supabase-js .rpc or direct fetch to PostgREST

  // Simplest approach: use the database connection string
  // But edge functions can't connect to pg directly easily.
  // Let's use the Supabase Management API or just parse and use PostgREST

  // Better approach: call a generic SQL function if it exists, or use the
  // database URL with a simple HTTP wrapper

  // Most practical: use the Supabase Data API (PostgREST) isn't suitable for raw SQL
  // We need to create a pg connection using the DB URL

  // Let's use Deno postgres
  const { Client } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");

  const client = new Client(dbUrl);
  await client.connect();
  try {
    const result = await client.queryObject(sql);
    return { rows: result.rows, rowCount: result.rowCount };
  } finally {
    await client.end();
  }
}

function isDangerousDDL(sql: string): boolean {
  const upper = sql.toUpperCase().trim();
  return /\b(DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE|DROP\s+SCHEMA)\b/.test(upper);
}

function isReadOnly(sql: string): boolean {
  const upper = sql.toUpperCase().trim();
  return upper.startsWith("SELECT") || upper.startsWith("WITH") || upper.startsWith("EXPLAIN");
}

function isDML(sql: string): boolean {
  const upper = sql.toUpperCase().trim();
  return upper.startsWith("INSERT") || upper.startsWith("UPDATE") || upper.startsWith("DELETE");
}

function isDDL(sql: string): boolean {
  const upper = sql.toUpperCase().trim();
  return upper.startsWith("ALTER") || upper.startsWith("CREATE");
}

async function handleToolCall(
  name: string,
  args: any,
  password: string,
  supabaseUrl: string
): Promise<string> {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");

  if (name === "query_database") {
    const sql = args.sql;
    if (!isReadOnly(sql)) {
      return JSON.stringify({ error: "Solo query SELECT sono permesse con query_database. Usa modify_data per modifiche." });
    }
    try {
      if (!dbUrl) return JSON.stringify({ error: "SUPABASE_DB_URL non configurato" });
      const result = await executeSql(null, sql, dbUrl);
      return JSON.stringify({ rows: result.rows, row_count: result.rowCount });
    } catch (e: any) {
      return JSON.stringify({ error: e.message });
    }
  }

  if (name === "modify_data") {
    const sql = args.sql;
    if (isDangerousDDL(sql)) {
      return JSON.stringify({ error: "Operazione non permessa: DROP/TRUNCATE non sono consentiti." });
    }
    if (!isDML(sql)) {
      return JSON.stringify({ error: "Solo INSERT/UPDATE/DELETE sono permessi con modify_data." });
    }
    try {
      if (!dbUrl) return JSON.stringify({ error: "SUPABASE_DB_URL non configurato" });
      const result = await executeSql(null, sql, dbUrl);
      return JSON.stringify({ success: true, rows_affected: result.rowCount, rows: result.rows });
    } catch (e: any) {
      return JSON.stringify({ error: e.message });
    }
  }

  if (name === "modify_schema") {
    const sql = args.sql;
    if (isDangerousDDL(sql)) {
      return JSON.stringify({ error: "Operazione non permessa: DROP/TRUNCATE non sono consentiti." });
    }
    if (!isDDL(sql)) {
      return JSON.stringify({ error: "Solo ALTER TABLE e CREATE TABLE sono permessi con modify_schema." });
    }
    try {
      if (!dbUrl) return JSON.stringify({ error: "SUPABASE_DB_URL non configurato" });
      const result = await executeSql(null, sql, dbUrl);
      return JSON.stringify({ success: true, message: "Schema modificato con successo." });
    } catch (e: any) {
      return JSON.stringify({ error: e.message });
    }
  }

  if (name === "list_firestore_events") {
    try {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const url = Deno.env.get("SUPABASE_URL")!;
      const res = await fetch(`${url}/functions/v1/import-firestore`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ password, action: "list" }),
      });
      const data = await res.json();
      return JSON.stringify(data);
    } catch (e: any) {
      return JSON.stringify({ error: e.message });
    }
  }

  if (name === "import_firestore_event") {
    try {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const url = Deno.env.get("SUPABASE_URL")!;
      const res = await fetch(`${url}/functions/v1/import-firestore`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ password, firestore_event_id: args.firestore_event_id }),
      });
      const data = await res.json();
      return JSON.stringify(data);
    } catch (e: any) {
      return JSON.stringify({ error: e.message });
    }
  }

  return JSON.stringify({ error: `Tool sconosciuto: ${name}` });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, messages } = await req.json();

    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!password || password !== adminPassword) {
      return new Response(JSON.stringify({ error: "Password non valida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY non configurata" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Build messages with system prompt
    const allMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    // Initial AI call with tools
    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: allMessages,
        tools: TOOLS,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: `Errore AI: ${response.status}` }), {
        status: response.status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data = await response.json();
    let assistantMessage = data.choices?.[0]?.message;

    // Tool call loop (max 10 iterations)
    let iterations = 0;
    while (assistantMessage?.tool_calls && iterations < 10) {
      iterations++;
      // Add assistant message to conversation
      allMessages.push(assistantMessage);

      // Execute all tool calls
      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: any;
        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          fnArgs = {};
        }

        console.log(`Tool call #${iterations}: ${fnName}`, fnArgs);
        const result = await handleToolCall(fnName, fnArgs, password, supabaseUrl);

        allMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Call AI again with tool results
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: allMessages,
          tools: TOOLS,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI gateway error (loop):", response.status, errText);
        break;
      }

      data = await response.json();
      assistantMessage = data.choices?.[0]?.message;
    }

    const content = assistantMessage?.content || "Non sono riuscito a elaborare la richiesta.";

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("admin-chat error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
