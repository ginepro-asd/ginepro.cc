import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.2";

type MembershipCardSummary = {
  id: string;
  card_number: string;
};

type RegistrationSummary = {
  nome: string;
  cognome: string;
  email: string;
  payment_method: string;
  event_id: string | null;
  participant_id: string | null;
};

export async function sendRegistrationConfirmation(
  supabaseAdmin: SupabaseClient,
  registrationId: string,
  card: MembershipCardSummary | null,
): Promise<RegistrationSummary | null> {
  const { data: registration, error: registrationError } = await supabaseAdmin
    .from("registrations")
    .select("nome, cognome, email, payment_method, event_id, participant_id")
    .eq("id", registrationId)
    .single();

  if (registrationError || !registration) {
    console.error("Failed to load registration for confirmation:", registrationError?.message);
    return null;
  }

  if (!registration.event_id) {
    return registration;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const internalHeaders = {
    "Authorization": `Bearer ${serviceRoleKey}`,
    "apikey": serviceRoleKey,
    "Content-Type": "application/json",
  };

  const { data: emailTemplate } = await supabaseAdmin
    .from("event_emails")
    .select("id")
    .eq("event_id", registration.event_id)
    .eq("trigger_type", "on_payment")
    .maybeSingle();

  if (emailTemplate) {
    const { error: eventEmailError } = await supabaseAdmin.functions.invoke("send-event-email", {
      body: {
        event_email_id: emailTemplate.id,
        registration_id: registrationId,
        mode: "single",
      },
    });

    if (eventEmailError) {
      console.error("Event email send failed:", eventEmailError.message);
    }

    return registration;
  }

  const { data: event } = await supabaseAdmin
    .from("events")
    .select("nome, data_evento, luogo, is_tesseramento")
    .eq("id", registration.event_id)
    .single();

  const confirmationRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: internalHeaders,
    body: JSON.stringify({
      templateName: "registration-confirmation",
      recipientEmail: registration.email,
      idempotencyKey: `registration-confirmation-${registrationId}`,
      templateData: {
        nome: registration.nome,
        cognome: registration.cognome,
        email: registration.email,
        paymentMethod: registration.payment_method,
        event: event ?? null,
        card: card ? { id: card.id, card_number: card.card_number } : null,
        participantId: registration.participant_id,
      },
    }),
  });

  if (!confirmationRes.ok) {
    console.error("Confirmation app email send failed:", await confirmationRes.text());
  }

  return registration;
}