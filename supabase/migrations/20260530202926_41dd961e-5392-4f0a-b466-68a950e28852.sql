
-- whatsapp_accounts
CREATE TABLE public.whatsapp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE,
  phone_number_id TEXT,
  waba_id TEXT,
  display_phone_number TEXT,
  verify_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  access_token TEXT,
  connected BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_accounts TO authenticated;
GRANT ALL ON public.whatsapp_accounts TO service_role;
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY sel ON public.whatsapp_accounts FOR SELECT TO authenticated USING (owns_client(client_id));
CREATE POLICY ins ON public.whatsapp_accounts FOR INSERT TO authenticated WITH CHECK (owns_client(client_id));
CREATE POLICY upd ON public.whatsapp_accounts FOR UPDATE TO authenticated USING (owns_client(client_id)) WITH CHECK (owns_client(client_id));
CREATE POLICY del ON public.whatsapp_accounts FOR DELETE TO authenticated USING (owns_client(client_id));
CREATE TRIGGER tg_wa_acc_upd BEFORE UPDATE ON public.whatsapp_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- whatsapp_conversations
CREATE TABLE public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  contact_wa_id TEXT NOT NULL,
  contact_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  unread_count INTEGER NOT NULL DEFAULT 0,
  is_lead BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, contact_wa_id)
);
CREATE INDEX idx_wa_conv_client ON public.whatsapp_conversations(client_id, last_message_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY sel ON public.whatsapp_conversations FOR SELECT TO authenticated USING (owns_client(client_id));
CREATE POLICY ins ON public.whatsapp_conversations FOR INSERT TO authenticated WITH CHECK (owns_client(client_id));
CREATE POLICY upd ON public.whatsapp_conversations FOR UPDATE TO authenticated USING (owns_client(client_id)) WITH CHECK (owns_client(client_id));
CREATE POLICY del ON public.whatsapp_conversations FOR DELETE TO authenticated USING (owns_client(client_id));
CREATE TRIGGER tg_wa_conv_upd BEFORE UPDATE ON public.whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- whatsapp_messages
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  wa_message_id TEXT,
  direction TEXT NOT NULL,
  from_bot BOOLEAN NOT NULL DEFAULT false,
  type TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  media_url TEXT,
  status TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_msg_conv ON public.whatsapp_messages(conversation_id, timestamp);
CREATE UNIQUE INDEX idx_wa_msg_waid ON public.whatsapp_messages(wa_message_id) WHERE wa_message_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY sel ON public.whatsapp_messages FOR SELECT TO authenticated USING (owns_client(client_id));
CREATE POLICY ins ON public.whatsapp_messages FOR INSERT TO authenticated WITH CHECK (owns_client(client_id));
CREATE POLICY upd ON public.whatsapp_messages FOR UPDATE TO authenticated USING (owns_client(client_id)) WITH CHECK (owns_client(client_id));
CREATE POLICY del ON public.whatsapp_messages FOR DELETE TO authenticated USING (owns_client(client_id));

-- whatsapp_bot_rules
CREATE TABLE public.whatsapp_bot_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Nueva regla',
  match_type TEXT NOT NULL DEFAULT 'keyword',
  keywords TEXT[] NOT NULL DEFAULT '{}',
  response_text TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  mark_as_lead BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_rules_client ON public.whatsapp_bot_rules(client_id, priority DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_bot_rules TO authenticated;
GRANT ALL ON public.whatsapp_bot_rules TO service_role;
ALTER TABLE public.whatsapp_bot_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY sel ON public.whatsapp_bot_rules FOR SELECT TO authenticated USING (owns_client(client_id));
CREATE POLICY ins ON public.whatsapp_bot_rules FOR INSERT TO authenticated WITH CHECK (owns_client(client_id));
CREATE POLICY upd ON public.whatsapp_bot_rules FOR UPDATE TO authenticated USING (owns_client(client_id)) WITH CHECK (owns_client(client_id));
CREATE POLICY del ON public.whatsapp_bot_rules FOR DELETE TO authenticated USING (owns_client(client_id));
CREATE TRIGGER tg_wa_rules_upd BEFORE UPDATE ON public.whatsapp_bot_rules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
