-- 1. Create satispay_accounts table
CREATE TABLE public.satispay_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_token TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure at most one default
CREATE UNIQUE INDEX satispay_accounts_one_default
  ON public.satispay_accounts (is_default) WHERE is_default = true;

-- updated_at trigger
CREATE TRIGGER satispay_accounts_updated_at
BEFORE UPDATE ON public.satispay_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: admin only
ALTER TABLE public.satispay_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view satispay accounts"
  ON public.satispay_accounts FOR SELECT
  TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can insert satispay accounts"
  ON public.satispay_accounts FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update satispay accounts"
  ON public.satispay_accounts FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete satispay accounts"
  ON public.satispay_accounts FOR DELETE
  TO authenticated USING (public.is_admin());

-- 2. Add FK on events
ALTER TABLE public.events
  ADD COLUMN satispay_account_id UUID REFERENCES public.satispay_accounts(id) ON DELETE SET NULL;

-- 3. Seed: rione-rosso credentials become "Ginepro" default
DO $$
DECLARE
  rr_url TEXT;
  rr_token TEXT;
  cr_url TEXT;
  cr_token TEXT;
  ginepro_id UUID;
  raniero_id UUID;
BEGIN
  SELECT satispay_api_url, satispay_api_token INTO rr_url, rr_token
  FROM public.events WHERE slug = 'rione-rosso-2026';

  SELECT satispay_api_url, satispay_api_token INTO cr_url, cr_token
  FROM public.events WHERE slug = 'castel-raniero-2026';

  IF rr_url IS NOT NULL AND rr_token IS NOT NULL THEN
    INSERT INTO public.satispay_accounts (nome, api_url, api_token, is_default, note)
    VALUES ('Ginepro', rr_url, rr_token, true, 'Account predefinito Ginepro')
    RETURNING id INTO ginepro_id;
  END IF;

  IF cr_url IS NOT NULL AND cr_token IS NOT NULL
     AND (cr_url, cr_token) IS DISTINCT FROM (rr_url, rr_token) THEN
    INSERT INTO public.satispay_accounts (nome, api_url, api_token, is_default, note)
    VALUES ('Castel Raniero', cr_url, cr_token, false, 'Importato da castel-raniero-2026')
    RETURNING id INTO raniero_id;
  END IF;

  -- Link events to accounts
  IF ginepro_id IS NOT NULL THEN
    UPDATE public.events SET satispay_account_id = ginepro_id
    WHERE satispay_api_url = rr_url AND satispay_api_token = rr_token;
  END IF;

  IF raniero_id IS NOT NULL THEN
    UPDATE public.events SET satispay_account_id = raniero_id
    WHERE satispay_api_url = cr_url AND satispay_api_token = cr_token;
  END IF;
END $$;