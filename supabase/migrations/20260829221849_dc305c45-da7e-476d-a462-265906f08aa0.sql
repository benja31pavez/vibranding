ALTER TABLE public.whatsapp_bot_rules
  ADD COLUMN IF NOT EXISTS flow_steps jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.client_leads
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_flow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.whatsapp_bot_rules(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'running',
  current_step_id text,
  awaiting_input boolean NOT NULL DEFAULT false,
  retry_count integer NOT NULL DEFAULT 0,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_run_at timestamptz,
  last_error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_flow_runs TO authenticated;
GRANT ALL ON public.whatsapp_flow_runs TO service_role;

ALTER TABLE public.whatsapp_flow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flow_runs select" ON public.whatsapp_flow_runs
  FOR SELECT TO authenticated USING (public.owns_client(client_id));
CREATE POLICY "flow_runs insert" ON public.whatsapp_flow_runs
  FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));
CREATE POLICY "flow_runs update" ON public.whatsapp_flow_runs
  FOR UPDATE TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "flow_runs delete" ON public.whatsapp_flow_runs
  FOR DELETE TO authenticated USING (public.owns_client(client_id));

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_flow_runs_active_uk
  ON public.whatsapp_flow_runs (conversation_id) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS whatsapp_flow_runs_due_idx
  ON public.whatsapp_flow_runs (next_run_at) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS whatsapp_conversations_tags_idx
  ON public.whatsapp_conversations USING gin (tags);

CREATE TRIGGER t_whatsapp_flow_runs_u BEFORE UPDATE ON public.whatsapp_flow_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();