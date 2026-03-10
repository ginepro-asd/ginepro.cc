ALTER TABLE public.events 
  ADD COLUMN location_lat double precision,
  ADD COLUMN location_lng double precision,
  ADD COLUMN location_label text;