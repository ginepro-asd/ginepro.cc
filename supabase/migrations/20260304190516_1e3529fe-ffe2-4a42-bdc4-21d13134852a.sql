
-- Add 'imported' to allowed payment methods
ALTER TABLE public.registrations DROP CONSTRAINT registrations_payment_method_check;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_payment_method_check 
  CHECK (payment_method = ANY (ARRAY['stripe'::text, 'satispay'::text, 'paypal'::text, 'imported'::text]));

-- Fix identification_type to include 'cf' 
ALTER TABLE public.registrations DROP CONSTRAINT registrations_identification_type_check;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_identification_type_check 
  CHECK (identification_type = ANY (ARRAY['birth'::text, 'fiscal'::text, 'cf'::text]));
