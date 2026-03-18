
-- 1. Add newsletter opt-in column to participants (default true = everyone is subscribed)
ALTER TABLE public.participants ADD COLUMN newsletter boolean NOT NULL DEFAULT true;

-- 2. Newsletters table
CREATE TABLE public.newsletters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  subject text NOT NULL,
  cta_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read newsletters" ON public.newsletters
  FOR SELECT TO public USING (true);

-- 3. Newsletter CTA clicks tracking
CREATE TABLE public.newsletter_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id uuid NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  clicked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(newsletter_id, participant_id)
);

ALTER TABLE public.newsletter_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert clicks" ON public.newsletter_clicks
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can read clicks" ON public.newsletter_clicks
  FOR SELECT TO public USING (true);
