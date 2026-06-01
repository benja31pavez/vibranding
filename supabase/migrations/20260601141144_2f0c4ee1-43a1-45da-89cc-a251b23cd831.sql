ALTER TABLE public.whatsapp_accounts
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS business_hours jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS needs_human_followup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_followup_reason text,
  ADD COLUMN IF NOT EXISTS human_followup_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_wa_conversations_followup
  ON public.whatsapp_conversations (client_id, human_followup_at DESC)
  WHERE needs_human_followup = true;