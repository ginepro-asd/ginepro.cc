
-- Create events table
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  nome text NOT NULL,
  descrizione text,
  data_evento date,
  luogo text,
  prezzo integer NOT NULL DEFAULT 1499,
  custom_fields jsonb DEFAULT '[]'::jsonb,
  scadenza_iscrizioni timestamp with time zone,
  attivo boolean NOT NULL DEFAULT true,
  hero_image text,
  payment_methods text[] DEFAULT ARRAY['stripe', 'satispay', 'paypal'],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone can read active events
CREATE POLICY "Anyone can read active events"
ON public.events FOR SELECT
TO anon, authenticated
USING (attivo = true);

-- Add event_id and custom_data to registrations
ALTER TABLE public.registrations
  ADD COLUMN event_id uuid REFERENCES public.events(id),
  ADD COLUMN custom_data jsonb DEFAULT '{}'::jsonb;

-- Create trigger for events updated_at
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
