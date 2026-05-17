-- Add "in_review" status to deliverables flow
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'in_review' BEFORE 'done';

-- Comments / review feedback for deliverables
CREATE TABLE IF NOT EXISTS public.deliverable_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  author text NOT NULL DEFAULT 'agency',
  kind text NOT NULL DEFAULT 'comment',
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deliverable_comments_deliverable ON public.deliverable_comments(deliverable_id, created_at);

ALTER TABLE public.deliverable_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel" ON public.deliverable_comments FOR SELECT TO authenticated USING (owns_client(client_id));
CREATE POLICY "ins" ON public.deliverable_comments FOR INSERT TO authenticated WITH CHECK (owns_client(client_id));
CREATE POLICY "upd" ON public.deliverable_comments FOR UPDATE TO authenticated USING (owns_client(client_id)) WITH CHECK (owns_client(client_id));
CREATE POLICY "del" ON public.deliverable_comments FOR DELETE TO authenticated USING (owns_client(client_id));