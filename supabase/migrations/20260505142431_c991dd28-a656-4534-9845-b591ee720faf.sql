CREATE OR REPLACE FUNCTION public.assign_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'domenico.diiorio@ginepro.cc' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_admin
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_super_admin();

-- Backfill if user already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'domenico.diiorio@ginepro.cc'
ON CONFLICT (user_id, role) DO NOTHING;