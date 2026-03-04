
-- Create participants table for unique user data
CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cognome text NOT NULL,
  email text NOT NULL UNIQUE,
  telefono text NOT NULL,
  codice_fiscale text,
  birth_date date,
  birth_place text,
  identification_type text NOT NULL DEFAULT 'birth',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read participants" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Anyone can create participants" ON public.participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update participants" ON public.participants FOR UPDATE USING (true);

-- Migrate existing data: insert distinct participants (prefer completed registrations)
INSERT INTO public.participants (nome, cognome, email, telefono, codice_fiscale, birth_date, birth_place, identification_type, created_at)
SELECT DISTINCT ON (lower(email)) nome, cognome, email, telefono, codice_fiscale, birth_date, birth_place, identification_type, created_at
FROM public.registrations
ORDER BY lower(email),
  CASE WHEN payment_status = 'completed' THEN 0 ELSE 1 END,
  created_at ASC;

-- Add participant_id FK to registrations
ALTER TABLE public.registrations ADD COLUMN participant_id uuid REFERENCES public.participants(id);

-- Populate participant_id for existing records
UPDATE public.registrations r
SET participant_id = p.id
FROM public.participants p
WHERE lower(r.email) = lower(p.email);

-- Trigger for updated_at
CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON public.participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
