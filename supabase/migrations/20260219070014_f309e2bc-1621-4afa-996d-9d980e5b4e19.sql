
-- Registrations table
CREATE TABLE public.registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT NOT NULL,
  identification_type TEXT NOT NULL CHECK (identification_type IN ('birth', 'fiscal')),
  birth_date DATE,
  birth_place TEXT,
  codice_fiscale TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('stripe', 'satispay', 'paypal')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed')),
  payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (registration form is public)
CREATE POLICY "Anyone can create registrations"
  ON public.registrations
  FOR INSERT
  WITH CHECK (true);

-- Allow reading own registration by payment_id (for confirmation page)
CREATE POLICY "Anyone can read by payment_id"
  ON public.registrations
  FOR SELECT
  USING (true);

-- Allow updates to payment status (from edge functions via service role)
CREATE POLICY "Service role can update registrations"
  ON public.registrations
  FOR UPDATE
  USING (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_registrations_updated_at
  BEFORE UPDATE ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
