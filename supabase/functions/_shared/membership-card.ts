import { createClient } from "npm:@supabase/supabase-js@2";
type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Creates a membership card for a tesseramento registration.
 * Returns the card data (id, card_number) or null if not a tesseramento.
 */
export async function createMembershipCardIfNeeded(
  supabaseAdmin: SupabaseClient,
  registrationId: string,
): Promise<{ id: string; card_number: string } | null> {
  // Fetch registration with event info
  const { data: reg } = await supabaseAdmin
    .from("registrations")
    .select("participant_id, event_id")
    .eq("id", registrationId)
    .single();

  if (!reg?.participant_id || !reg?.event_id) return null;

  // Check if event is tesseramento
  const { data: event } = await supabaseAdmin
    .from("events")
    .select("is_tesseramento")
    .eq("id", reg.event_id)
    .single();

  if (!event?.is_tesseramento) return null;

  // Check if card already exists
  const { data: existing } = await supabaseAdmin
    .from("membership_cards")
    .select("id, card_number")
    .eq("participant_id", reg.participant_id)
    .eq("registration_id", registrationId)
    .maybeSingle();

  if (existing) return existing;

  // Get current year
  const year = new Date().getFullYear();

  // Get the next sequential number for this year
  const { data: lastCard } = await supabaseAdmin
    .from("membership_cards")
    .select("card_number")
    .eq("year", year)
    .order("card_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNum = 1;
  if (lastCard?.card_number) {
    const parts = lastCard.card_number.split("-");
    const lastNum = parseInt(parts[1], 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  const cardNumber = `${year}-${String(nextNum).padStart(3, "0")}`;

  const { data: card, error } = await supabaseAdmin
    .from("membership_cards")
    .insert({
      participant_id: reg.participant_id,
      registration_id: registrationId,
      year,
      card_number: cardNumber,
    })
    .select("id, card_number")
    .single();

  if (error) {
    console.error("Error creating membership card:", error.message);
    return null;
  }

  console.log("Membership card created:", card.card_number, "for registration:", registrationId);
  return card;
}
