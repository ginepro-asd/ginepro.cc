ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS visibile_in_landing boolean NOT NULL DEFAULT true;
