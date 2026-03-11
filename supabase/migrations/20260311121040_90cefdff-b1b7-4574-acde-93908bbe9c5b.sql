
ALTER TABLE public.participants ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE;
