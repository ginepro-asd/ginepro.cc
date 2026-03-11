import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { participant_id, email, password } = await req.json();

    if (!participant_id || !email || !password) {
      throw new Error("Missing required fields: participant_id, email, password");
    }

    if (password.length < 6) {
      throw new Error("La password deve essere di almeno 6 caratteri");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify participant exists and email matches
    const { data: participant, error: partErr } = await supabaseAdmin
      .from("participants")
      .select("id, email, auth_user_id, nome, cognome")
      .eq("id", participant_id)
      .single();

    if (partErr || !participant) {
      throw new Error("Partecipante non trovato");
    }

    if (participant.email.toLowerCase() !== email.toLowerCase()) {
      throw new Error("L'email non corrisponde a quella registrata");
    }

    // Check if already has an account
    if (participant.auth_user_id) {
      throw new Error("Questo account è già stato configurato. Usa il login.");
    }

    // Check if an auth user with this email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let authUserId: string;

    if (existingUser) {
      // Update password for existing user
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { password, email_confirm: true }
      );
      if (updateErr) throw updateErr;
      authUserId = existingUser.id;
    } else {
      // Create new confirmed auth user
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          nome: participant.nome,
          cognome: participant.cognome,
        },
      });
      if (createErr) throw createErr;
      authUserId = newUser.user.id;
    }

    // Link auth user to participant
    const { error: linkErr } = await supabaseAdmin
      .from("participants")
      .update({ auth_user_id: authUserId })
      .eq("id", participant_id);

    if (linkErr) throw linkErr;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("setup-account error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
