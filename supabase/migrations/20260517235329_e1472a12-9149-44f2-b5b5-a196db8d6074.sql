
CREATE TABLE public.landing_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name text NOT NULL,
  lang text,
  path text,
  referrer text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX landing_events_name_created_idx ON public.landing_events (event_name, created_at DESC);

ALTER TABLE public.landing_events ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can insert click events
CREATE POLICY "Anyone can insert landing events"
ON public.landing_events
FOR INSERT
TO anon, authenticated
WITH CHECK (event_name IN ('contact_click', 'whatsapp_click'));

-- Only authenticated users (the admin) can read stats
CREATE POLICY "Authenticated can read landing events"
ON public.landing_events
FOR SELECT
TO authenticated
USING (true);
