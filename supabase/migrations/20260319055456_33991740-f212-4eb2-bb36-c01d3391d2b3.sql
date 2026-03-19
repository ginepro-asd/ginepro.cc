
-- Add sent_at to track when a newsletter was bulk-sent
ALTER TABLE public.newsletters ADD COLUMN sent_at timestamp with time zone DEFAULT NULL;

-- Create table to track unsubscribes per newsletter
CREATE TABLE public.newsletter_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id uuid NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  unsubscribed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(newsletter_id, participant_id)
);

ALTER TABLE public.newsletter_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert unsubscribes" ON public.newsletter_unsubscribes FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can read unsubscribes" ON public.newsletter_unsubscribes FOR SELECT TO public USING (true);
