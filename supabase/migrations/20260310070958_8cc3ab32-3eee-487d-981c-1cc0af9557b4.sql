
ALTER TABLE public.events ADD COLUMN is_coppia boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN pettorale_start integer DEFAULT NULL;
