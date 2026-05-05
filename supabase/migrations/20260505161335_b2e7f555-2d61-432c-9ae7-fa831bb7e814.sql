
CREATE TABLE public.societa (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX societa_nome_lower_idx ON public.societa (lower(nome));

ALTER TABLE public.societa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read societa" ON public.societa FOR SELECT USING (true);
CREATE POLICY "Admins can insert societa" ON public.societa FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admins can update societa" ON public.societa FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admins can delete societa" ON public.societa FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Service role can insert societa" ON public.societa FOR INSERT TO service_role WITH CHECK (true);

CREATE TRIGGER update_societa_updated_at BEFORE UPDATE ON public.societa FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.participants ADD COLUMN societa_id uuid;
ALTER TABLE public.registrations ADD COLUMN societa_id uuid, ADD COLUMN societa_nome text;
ALTER TABLE public.events ADD COLUMN richiedi_societa boolean NOT NULL DEFAULT false;

-- Seed Ginepro society
INSERT INTO public.societa (nome, note) VALUES ('GINEPRO', 'Società di default');

-- Migrate existing tesseramento participants → GINEPRO
UPDATE public.participants p
SET societa_id = (SELECT id FROM public.societa WHERE nome = 'GINEPRO')
WHERE EXISTS (
  SELECT 1 FROM public.registrations r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.participant_id = p.id
    AND e.is_tesseramento = true
    AND e.slug LIKE 'tesseramento-%'
);
