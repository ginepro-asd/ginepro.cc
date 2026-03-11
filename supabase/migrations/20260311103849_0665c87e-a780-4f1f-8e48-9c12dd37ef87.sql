
-- Add photo/signature columns to participants
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS photo_thumb_url text;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS signature_url text;

-- Create membership_cards table
CREATE TABLE public.membership_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  card_number text NOT NULL UNIQUE,
  year integer NOT NULL DEFAULT 2026,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(participant_id, year)
);
ALTER TABLE public.membership_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read cards" ON public.membership_cards FOR SELECT TO public USING (true);
CREATE POLICY "Service role can insert cards" ON public.membership_cards FOR INSERT TO service_role WITH CHECK (true);

-- Create medical_certificates table
CREATE TABLE public.medical_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  registration_id uuid REFERENCES public.registrations(id) ON DELETE SET NULL,
  file_path text NOT NULL,
  expiry_date date,
  disciplines text[] DEFAULT '{}',
  ai_warning text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read certificates" ON public.medical_certificates FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert certificates" ON public.medical_certificates FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Service role can update certificates" ON public.medical_certificates FOR UPDATE TO service_role USING (true);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('member-photos', 'member-photos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('member-signatures', 'member-signatures', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('medical-certificates', 'medical-certificates', false) ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for member-photos (public read, anyone can upload)
CREATE POLICY "Anyone can upload photos" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'member-photos');
CREATE POLICY "Anyone can read photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'member-photos');

-- Storage RLS policies for member-signatures
CREATE POLICY "Anyone can upload signatures" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'member-signatures');
CREATE POLICY "Anyone can read signatures" ON storage.objects FOR SELECT TO public USING (bucket_id = 'member-signatures');

-- Storage RLS policies for medical-certificates (private - service role handles reads)
CREATE POLICY "Anyone can upload certificates" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'medical-certificates');
CREATE POLICY "Service role can read certificates" ON storage.objects FOR SELECT TO service_role USING (bucket_id = 'medical-certificates');
