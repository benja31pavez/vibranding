-- 1) Unified inbox: conversations and messages carry a channel ------------
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS ig_account_id text,
  ADD COLUMN IF NOT EXISTS contact_username text,
  ALTER COLUMN account_id DROP NOT NULL;

ALTER TABLE public.whatsapp_conversations
  DROP CONSTRAINT IF EXISTS whatsapp_conversations_channel_chk;
ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_channel_chk
  CHECK (channel IN ('whatsapp', 'instagram'));

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_ig_contact_uk
  ON public.whatsapp_conversations (client_id, contact_wa_id)
  WHERE channel = 'instagram';

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp';

-- 2) Comment-to-DM triggers ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.ig_comment_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ig_media_id text,                        -- NULL = applies to every media
  name text NOT NULL DEFAULT 'Automatización',
  keywords text[] NOT NULL DEFAULT '{}',
  match_type text NOT NULL DEFAULT 'keyword',
  dm_message text NOT NULL,
  public_reply text,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  triggered_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ig_comment_triggers_match_type_chk
    CHECK (match_type IN ('keyword', 'exact', 'starts_with', 'any'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_comment_triggers TO authenticated;
GRANT ALL ON public.ig_comment_triggers TO service_role;
ALTER TABLE public.ig_comment_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel" ON public.ig_comment_triggers FOR SELECT TO authenticated
  USING (public.owns_client(client_id));
CREATE POLICY "ins" ON public.ig_comment_triggers FOR INSERT TO authenticated
  WITH CHECK (public.owns_client(client_id));
CREATE POLICY "upd" ON public.ig_comment_triggers FOR UPDATE TO authenticated
  USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "del" ON public.ig_comment_triggers FOR DELETE TO authenticated
  USING (public.owns_client(client_id));

CREATE TRIGGER t_ig_comment_triggers_u BEFORE UPDATE ON public.ig_comment_triggers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS ig_comment_triggers_client_idx
  ON public.ig_comment_triggers (client_id, is_active, priority DESC);

-- 3) Attempt log ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ig_automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  trigger_id uuid REFERENCES public.ig_comment_triggers(id) ON DELETE SET NULL,
  comment_id text NOT NULL,
  ig_media_id text,
  commenter_id text,
  commenter_username text,
  comment_text text,
  matched boolean NOT NULL DEFAULT false,
  dm_status text NOT NULL DEFAULT 'skipped',
  dm_error text,
  reply_status text NOT NULL DEFAULT 'skipped',
  reply_error text,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ig_automation_events_dm_status_chk
    CHECK (dm_status IN ('sent', 'failed', 'skipped', 'window_closed')),
  CONSTRAINT ig_automation_events_reply_status_chk
    CHECK (reply_status IN ('sent', 'failed', 'skipped'))
);

-- One log row per comment: also the idempotency guard for webhook retries.
CREATE UNIQUE INDEX IF NOT EXISTS ig_automation_events_comment_uk
  ON public.ig_automation_events (comment_id);
CREATE INDEX IF NOT EXISTS ig_automation_events_client_idx
  ON public.ig_automation_events (client_id, created_at DESC);

GRANT SELECT ON public.ig_automation_events TO authenticated;
GRANT ALL ON public.ig_automation_events TO service_role;
ALTER TABLE public.ig_automation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel" ON public.ig_automation_events FOR SELECT TO authenticated
  USING (public.owns_client(client_id));

-- 4) Counter helper used by the webhook (service role only) --------------
CREATE OR REPLACE FUNCTION public.ig_trigger_bump(
  _trigger_id uuid, _triggered int, _sent int, _failed int
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ig_comment_triggers
  SET triggered_count = triggered_count + coalesce(_triggered, 0),
      sent_count = sent_count + coalesce(_sent, 0),
      failed_count = failed_count + coalesce(_failed, 0),
      last_triggered_at = CASE WHEN coalesce(_triggered, 0) > 0 THEN now() ELSE last_triggered_at END
  WHERE id = _trigger_id;
$$;

REVOKE ALL ON FUNCTION public.ig_trigger_bump(uuid, int, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ig_trigger_bump(uuid, int, int, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ig_trigger_bump(uuid, int, int, int) TO service_role;