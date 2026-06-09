
-- Lead meta + Bot knowledge tables
CREATE TABLE public.lead_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('whatsapp','landing')),
  source_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','won','lost')),
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, source, source_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_meta TO authenticated;
GRANT ALL ON public.lead_meta TO service_role;
ALTER TABLE public.lead_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all lead_meta" ON public.lead_meta
  TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE TRIGGER tg_lead_meta_upd BEFORE UPDATE ON public.lead_meta
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_lead_meta_client ON public.lead_meta(client_id, status);

CREATE TABLE public.bot_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text,
  origin text NOT NULL DEFAULT 'onboarding' CHECK (origin IN ('onboarding','auto')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','answered','dismissed')),
  context_snippet text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_knowledge TO authenticated;
GRANT ALL ON public.bot_knowledge TO service_role;
ALTER TABLE public.bot_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all bot_knowledge" ON public.bot_knowledge
  TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE TRIGGER tg_bot_knowledge_upd BEFORE UPDATE ON public.bot_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_bot_knowledge_account_status ON public.bot_knowledge(account_id, status);
