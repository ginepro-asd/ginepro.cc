
CREATE TABLE public.event_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  slug text NOT NULL,
  subject text NOT NULL,
  body_html text,
  trigger_type text NOT NULL DEFAULT 'manual',
  orario_map jsonb DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, slug)
);

ALTER TABLE public.event_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read event_emails" ON public.event_emails FOR SELECT TO public USING (true);
CREATE POLICY "Service role can insert event_emails" ON public.event_emails FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role can update event_emails" ON public.event_emails FOR UPDATE TO service_role USING (true);
CREATE POLICY "Service role can delete event_emails" ON public.event_emails FOR DELETE TO service_role USING (true);

CREATE TABLE public.event_email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_email_id uuid NOT NULL REFERENCES public.event_emails(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_email_id, registration_id)
);

ALTER TABLE public.event_email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read event_email_sends" ON public.event_email_sends FOR SELECT TO public USING (true);
CREATE POLICY "Service role can insert event_email_sends" ON public.event_email_sends FOR INSERT TO service_role WITH CHECK (true);
