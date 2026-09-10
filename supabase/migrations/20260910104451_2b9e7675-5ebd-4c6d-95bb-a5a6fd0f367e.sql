CREATE TABLE public.ig_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('ok','error')),
  requested_label text,
  persisted_label text,
  version_id uuid,
  media_count integer,
  swapped boolean NOT NULL DEFAULT false,
  is_baseline boolean NOT NULL DEFAULT false,
  note text,
  error text,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ig_sync_runs_client_created_idx ON public.ig_sync_runs (client_id, created_at DESC);

GRANT SELECT ON public.ig_sync_runs TO authenticated;
GRANT ALL ON public.ig_sync_runs TO service_role;

ALTER TABLE public.ig_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ig_sync_runs_select" ON public.ig_sync_runs
  FOR SELECT TO authenticated
  USING (public.owns_client(client_id));