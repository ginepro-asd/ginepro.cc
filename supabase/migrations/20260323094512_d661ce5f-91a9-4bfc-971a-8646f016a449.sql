
-- Check if constraint exists, drop it, and recreate with new values
DO $$
BEGIN
  -- Try dropping common constraint names
  BEGIN
    ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_payment_method_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS check_payment_method;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Add the updated constraint
ALTER TABLE public.registrations ADD CONSTRAINT registrations_payment_method_check 
  CHECK (payment_method = ANY (ARRAY['stripe','satispay','paypal','imported','contanti','admin']));
