-- ── Deliverables: per-item checklist toggle ─────────────────────────────
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS checklist_enabled boolean NOT NULL DEFAULT false;

UPDATE public.deliverables SET checklist_enabled = true
WHERE jsonb_array_length(coalesce(checklist, '[]'::jsonb)) > 0;

-- ── Merge dividers into folders, then drop dividers ─────────────────────
INSERT INTO public.deliverable_folders (client_id, name, sort_order, created_at)
SELECT d.client_id, coalesce(nullif(btrim(d.label), ''), 'Fase'), d.sort_order, d.created_at
FROM public.deliverable_dividers d;

DROP TABLE IF EXISTS public.deliverable_dividers;

-- ── Comments: real actor + agency read state ────────────────────────────
ALTER TABLE public.deliverable_comments
  ADD COLUMN IF NOT EXISTS author_user_id uuid,
  ADD COLUMN IF NOT EXISTS author_role text NOT NULL DEFAULT 'agency',
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS read_by_agency boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE public.deliverable_comments
    ADD CONSTRAINT deliverable_comments_author_role_chk
    CHECK (author_role IN ('agency', 'client', 'guest'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS deliverable_comments_unread_idx
  ON public.deliverable_comments (client_id, read_by_agency)
  WHERE read_by_agency = false;

CREATE POLICY "client user reads deliverable_comments"
  ON public.deliverable_comments FOR SELECT TO authenticated
  USING (client_id = public.user_client_id());

-- ── Shareable, expiring review links ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deliverable_review_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverable_review_links TO authenticated;
GRANT ALL ON public.deliverable_review_links TO service_role;

ALTER TABLE public.deliverable_review_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency reads review links" ON public.deliverable_review_links
  FOR SELECT TO authenticated USING (public.owns_client(client_id));
CREATE POLICY "agency creates review links" ON public.deliverable_review_links
  FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));
CREATE POLICY "agency updates review links" ON public.deliverable_review_links
  FOR UPDATE TO authenticated USING (public.owns_client(client_id))
  WITH CHECK (public.owns_client(client_id));
CREATE POLICY "agency deletes review links" ON public.deliverable_review_links
  FOR DELETE TO authenticated USING (public.owns_client(client_id));

CREATE TRIGGER t_deliverable_review_links_u BEFORE UPDATE
  ON public.deliverable_review_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Objectives: metric source wiring ───────────────────────────────────
ALTER TABLE public.objectives
  ADD COLUMN IF NOT EXISTS metric_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS metric_synced_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.objectives
    ADD CONSTRAINT objectives_metric_source_chk
    CHECK (metric_source IN ('manual', 'ig_followers', 'ig_engagement', 'ad_spend', 'conversations_closed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Org-scoped objective templates ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.objective_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.objective_templates TO authenticated;
GRANT ALL ON public.objective_templates TO service_role;

ALTER TABLE public.objective_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members read objective templates" ON public.objective_templates
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "org members create objective templates" ON public.objective_templates
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org members update objective templates" ON public.objective_templates
  FOR UPDATE TO authenticated USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "org members delete objective templates" ON public.objective_templates
  FOR DELETE TO authenticated USING (public.is_org_member(org_id));

CREATE TRIGGER t_objective_templates_u BEFORE UPDATE
  ON public.objective_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();