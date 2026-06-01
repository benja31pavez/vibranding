ALTER TABLE public.whatsapp_bot_rules
  ADD COLUMN IF NOT EXISTS actions jsonb NOT NULL DEFAULT '[]'::jsonb;