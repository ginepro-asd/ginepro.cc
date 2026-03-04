
-- Drop the restrictive policy and replace with one that allows reading all events
DROP POLICY IF EXISTS "Anyone can read active events" ON public.events;

CREATE POLICY "Anyone can read events"
ON public.events
FOR SELECT
USING (true);
