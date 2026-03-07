
-- Add unique constraint on participants (nome, cognome)
ALTER TABLE public.participants ADD CONSTRAINT participants_nome_cognome_unique UNIQUE (nome, cognome);

-- Add unique constraint on registrations (participant_id, event_id)
ALTER TABLE public.registrations ADD CONSTRAINT registrations_participant_event_unique UNIQUE (participant_id, event_id);
