CREATE TABLE IF NOT EXISTS public.ig_dm_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'keyword',
  name text NOT NULL DEFAULT 'Automatización',
  keywords text[] NOT NULL DEFAULT '{}',
  match_type text NOT NULL DEFAULT 'keyword',
  message text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  triggered_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ig_dm_triggers_kind_chk CHECK (kind IN ('keyword', 'welcome')),
  CONSTRAINT ig_dm_triggers_match_type_chk
    CHECK (match_type IN ('keyword', 'exact', 'starts_with', 'any'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ig_dm_triggers TO authenticated;
GRANT ALL ON public.ig_dm_triggers TO service_role;
ALTER TABLE public.ig_dm_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel" ON public.ig_dm_triggers FOR SELECT TO authenticated
  USING (public.owns_client(client_id));
CREATE POLICY "ins" ON public.ig_dm_triggers FOR INSERT TO authenticated
  WITH CHECK (public.owns_client(client_id));
CREATE POLICY "upd" ON public.ig_dm_triggers FOR UPDATE TO authenticated
  USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "del" ON public.ig_dm_triggers FOR DELETE TO authenticated
  USING (public.owns_client(client_id));

CREATE TRIGGER t_ig_dm_triggers_u BEFORE UPDATE ON public.ig_dm_triggers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS ig_dm_triggers_client_idx
  ON public.ig_dm_triggers (client_id, kind, is_active, priority DESC);

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;

CREATE OR REPLACE FUNCTION public.ig_dm_trigger_bump(
  _trigger_id uuid, _triggered int, _sent int, _failed int
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ig_dm_triggers
  SET triggered_count = triggered_count + coalesce(_triggered, 0),
      sent_count = sent_count + coalesce(_sent, 0),
      failed_count = failed_count + coalesce(_failed, 0),
      last_triggered_at = CASE WHEN coalesce(_triggered, 0) > 0 THEN now() ELSE last_triggered_at END
  WHERE id = _trigger_id;
$$;

REVOKE ALL ON FUNCTION public.ig_dm_trigger_bump(uuid, int, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ig_dm_trigger_bump(uuid, int, int, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ig_dm_trigger_bump(uuid, int, int, int) TO service_role;