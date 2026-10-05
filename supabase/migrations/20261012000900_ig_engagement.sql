-- =====================================================================
-- Instagram engagement snapshots (PR feat/instagram-engagement)
--
-- Cache of engagement measurements taken with the official Instagram Graph
-- API (own connected account or Business Discovery). One row per measurement;
-- the UI shows the latest one and the server skips Graph calls while the last
-- successful row is < 12 h old (rate limits).
--
-- Reads: any agency org member of the client (owns_client, incl. viewers).
-- Writes: service_role only (server functions), never the browser.
-- Idempotent: safe to run more than once.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ig_engagement_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  measured_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('own', 'discovery')),
  username text,
  followers integer CHECK (followers IS NULL OR followers >= 0),
  posts_sampled integer CHECK (posts_sampled IS NULL OR posts_sampled >= 0),
  avg_likes numeric CHECK (avg_likes IS NULL OR avg_likes >= 0),
  avg_comments numeric CHECK (avg_comments IS NULL OR avg_comments >= 0),
  engagement_rate numeric CHECK (engagement_rate IS NULL OR engagement_rate >= 0),
  posts_per_week numeric CHECK (posts_per_week IS NULL OR posts_per_week >= 0),
  error text,
  -- Either a full measurement or an error message, never a half-filled row.
  CONSTRAINT ig_engagement_snapshots_result_chk CHECK (
    (error IS NOT NULL AND engagement_rate IS NULL)
    OR (error IS NULL AND engagement_rate IS NOT NULL AND followers IS NOT NULL
        AND posts_sampled IS NOT NULL)
  )
);

COMMENT ON TABLE public.ig_engagement_snapshots IS
  'Mediciones de engagement de Instagram (Graph API: cuenta propia o Business Discovery). Leen miembros de la org (owns_client); escribe solo service_role.';

CREATE INDEX IF NOT EXISTS ig_engagement_snapshots_client_measured_idx
  ON public.ig_engagement_snapshots (client_id, measured_at DESC);

ALTER TABLE public.ig_engagement_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ig_engagement_snapshots FROM anon, authenticated;
GRANT SELECT ON public.ig_engagement_snapshots TO authenticated;
GRANT ALL ON public.ig_engagement_snapshots TO service_role;

DROP POLICY IF EXISTS "ig engagement select" ON public.ig_engagement_snapshots;
CREATE POLICY "ig engagement select" ON public.ig_engagement_snapshots
  FOR SELECT TO authenticated
  USING (public.owns_client(client_id));
-- No INSERT/UPDATE/DELETE policies: only service_role (bypasses RLS) writes.
