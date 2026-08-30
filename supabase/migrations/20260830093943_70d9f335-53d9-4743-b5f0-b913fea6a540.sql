CREATE TABLE public.instagram_audience_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  breakdown text NOT NULL CHECK (breakdown IN ('age','gender','country','city','age_gender')),
  key text NOT NULL,
  value bigint NOT NULL DEFAULT 0,
  followers_total integer,
  breakdown_total bigint,
  coverage numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (client_id, date, breakdown, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_audience_snapshots TO authenticated;
GRANT ALL ON public.instagram_audience_snapshots TO service_role;

ALTER TABLE public.instagram_audience_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audience snapshots select" ON public.instagram_audience_snapshots
  FOR SELECT TO authenticated
  USING (public.owns_client(client_id) OR client_id = public.user_client_id());

CREATE POLICY "audience snapshots insert" ON public.instagram_audience_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_client(client_id));

CREATE POLICY "audience snapshots update" ON public.instagram_audience_snapshots
  FOR UPDATE TO authenticated
  USING (public.owns_client(client_id))
  WITH CHECK (public.owns_client(client_id));

CREATE POLICY "audience snapshots delete" ON public.instagram_audience_snapshots
  FOR DELETE TO authenticated
  USING (public.manages_client(client_id));

CREATE INDEX instagram_audience_snapshots_client_date_idx
  ON public.instagram_audience_snapshots (client_id, date DESC);

CREATE TRIGGER t_instagram_audience_snapshots_u
  BEFORE UPDATE ON public.instagram_audience_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();