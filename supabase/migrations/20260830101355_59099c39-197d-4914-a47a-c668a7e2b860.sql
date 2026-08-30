CREATE TABLE public.instagram_grid_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','sync')),
  is_baseline boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX instagram_grid_versions_client_label_uk
  ON public.instagram_grid_versions (client_id, lower(label));
CREATE INDEX instagram_grid_versions_client_idx
  ON public.instagram_grid_versions (client_id, captured_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_grid_versions TO authenticated;
GRANT ALL ON public.instagram_grid_versions TO service_role;

ALTER TABLE public.instagram_grid_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel" ON public.instagram_grid_versions FOR SELECT TO authenticated USING (public.owns_client(client_id));
CREATE POLICY "ins" ON public.instagram_grid_versions FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));
CREATE POLICY "upd" ON public.instagram_grid_versions FOR UPDATE TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "del" ON public.instagram_grid_versions FOR DELETE TO authenticated USING (public.owns_client(client_id));

CREATE TRIGGER instagram_grid_versions_touch
  BEFORE UPDATE ON public.instagram_grid_versions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.instagram_posts
  ADD COLUMN version_id uuid REFERENCES public.instagram_grid_versions(id) ON DELETE CASCADE;

CREATE INDEX instagram_posts_version_idx ON public.instagram_posts (version_id);

-- Backfill: one baseline version per client that already has "current" rows.
WITH src AS (
  SELECT client_id, min(created_at) AS first_at
  FROM public.instagram_posts
  WHERE type = 'current'
  GROUP BY client_id
), inserted AS (
  INSERT INTO public.instagram_grid_versions (client_id, label, captured_at, source, is_baseline)
  SELECT client_id, 'Estado inicial', first_at, 'manual', true FROM src
  RETURNING id, client_id
)
UPDATE public.instagram_posts p
SET version_id = i.id
FROM inserted i
WHERE p.client_id = i.client_id AND p.type = 'current';