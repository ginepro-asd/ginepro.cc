CREATE TABLE public.newsletter_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id uuid NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT true,
  UNIQUE(newsletter_id, participant_id)
);

ALTER TABLE public.newsletter_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sends" ON public.newsletter_sends FOR SELECT TO public USING (true);
CREATE POLICY "Service role can insert sends" ON public.newsletter_sends FOR INSERT TO service_role WITH CHECK (true);