
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_payment_status_check;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_payment_status_check CHECK (payment_status = ANY (ARRAY['pending', 'completed', 'failed', 'cancelled']));

-- Fix any existing 'paid' records
UPDATE public.registrations SET payment_status = 'completed' WHERE payment_status = 'paid';
