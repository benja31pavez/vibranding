-- lovable-cron-fallback-reviewed: 1 run/day; Meta's insights API has no push/webhook for daily ad metrics, so a once-daily pull is the minimum viable cadence

-- =========================================================
-- 1. Connected Meta accounts (token in Vault)
-- =========================================================
CREATE TABLE public.meta_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ad_account_id text,
  page_id text,
  ig_account_id text,
  business_name text,
  token_secret_id uuid,
  token_expires_at timestamptz,
  scopes text[] NOT NULL DEFAULT '{}',
  connected boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_accounts TO authenticated;
GRANT ALL ON public.meta_accounts TO service_role;
ALTER TABLE public.meta_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_accounts select" ON public.meta_accounts FOR SELECT TO authenticated
  USING (public.owns_client(client_id));
CREATE POLICY "meta_accounts insert" ON public.meta_accounts FOR INSERT TO authenticated
  WITH CHECK (public.owns_client(client_id));
CREATE POLICY "meta_accounts update" ON public.meta_accounts FOR UPDATE TO authenticated
  USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "meta_accounts delete" ON public.meta_accounts FOR DELETE TO authenticated
  USING (public.owns_client(client_id));

CREATE TRIGGER t_meta_accounts_u BEFORE UPDATE ON public.meta_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Vault accessors for the Meta user token (service role only)
CREATE OR REPLACE FUNCTION public.meta_get_secret(_account_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE sid uuid; val text;
BEGIN
  SELECT token_secret_id INTO sid FROM public.meta_accounts WHERE id = _account_id;
  IF sid IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO val FROM vault.decrypted_secrets WHERE id = sid;
  RETURN val;
END $$;

CREATE OR REPLACE FUNCTION public.meta_set_secret(_account_id uuid, _secret text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE sid uuid; nm text;
BEGIN
  SELECT token_secret_id INTO sid FROM public.meta_accounts WHERE id = _account_id;

  IF _secret IS NULL OR btrim(_secret) = '' THEN
    IF sid IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = sid; END IF;
    UPDATE public.meta_accounts SET token_secret_id = NULL WHERE id = _account_id;
    RETURN NULL;
  END IF;

  IF sid IS NULL THEN
    nm := 'meta_user_token_' || _account_id::text;
    sid := vault.create_secret(_secret, nm, 'Meta long-lived user token');
    UPDATE public.meta_accounts SET token_secret_id = sid WHERE id = _account_id;
  ELSE
    PERFORM vault.update_secret(sid, _secret);
  END IF;
  RETURN sid;
END $$;

REVOKE ALL ON FUNCTION public.meta_get_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.meta_set_secret(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_get_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.meta_set_secret(uuid, text) TO service_role;

-- =========================================================
-- 2. Daily ad insights (idempotent per tenant/date/entity)
-- =========================================================
CREATE TABLE public.ad_insights_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  level text NOT NULL DEFAULT 'ad' CHECK (level IN ('account', 'campaign', 'adset', 'ad')),
  entity_id text NOT NULL,
  campaign_id text,
  adset_id text,
  ad_id text,
  campaign_name text,
  adset_name text,
  ad_name text,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  ctr numeric,
  cpm numeric,
  messaging_conversations_started bigint NOT NULL DEFAULT 0,
  currency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, date, entity_id)
);

CREATE INDEX ad_insights_daily_client_date_idx ON public.ad_insights_daily (client_id, date DESC);
CREATE INDEX ad_insights_daily_ad_idx ON public.ad_insights_daily (client_id, ad_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_insights_daily TO authenticated;
GRANT ALL ON public.ad_insights_daily TO service_role;
ALTER TABLE public.ad_insights_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_insights select" ON public.ad_insights_daily FOR SELECT TO authenticated
  USING (public.owns_client(client_id));
CREATE POLICY "ad_insights insert" ON public.ad_insights_daily FOR INSERT TO authenticated
  WITH CHECK (public.owns_client(client_id));
CREATE POLICY "ad_insights update" ON public.ad_insights_daily FOR UPDATE TO authenticated
  USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "ad_insights delete" ON public.ad_insights_daily FOR DELETE TO authenticated
  USING (public.owns_client(client_id));

CREATE TRIGGER t_ad_insights_daily_u BEFORE UPDATE ON public.ad_insights_daily
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 3. Daily organic post insights
-- =========================================================
CREATE TABLE public.post_insights_daily (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  post_id text NOT NULL,
  platform text NOT NULL DEFAULT 'instagram' CHECK (platform IN ('instagram', 'facebook')),
  permalink text,
  media_type text,
  reach bigint NOT NULL DEFAULT 0,
  engagement bigint NOT NULL DEFAULT 0,
  saves bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, date, post_id)
);

CREATE INDEX post_insights_daily_client_date_idx ON public.post_insights_daily (client_id, date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_insights_daily TO authenticated;
GRANT ALL ON public.post_insights_daily TO service_role;
ALTER TABLE public.post_insights_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_insights select" ON public.post_insights_daily FOR SELECT TO authenticated
  USING (public.owns_client(client_id));
CREATE POLICY "post_insights insert" ON public.post_insights_daily FOR INSERT TO authenticated
  WITH CHECK (public.owns_client(client_id));
CREATE POLICY "post_insights update" ON public.post_insights_daily FOR UPDATE TO authenticated
  USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "post_insights delete" ON public.post_insights_daily FOR DELETE TO authenticated
  USING (public.owns_client(client_id));

CREATE TRIGGER t_post_insights_daily_u BEFORE UPDATE ON public.post_insights_daily
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- 4. Click-to-WhatsApp attribution
-- =========================================================
CREATE TABLE public.attributions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  ctwa_clid text NOT NULL,
  conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  ad_id text,
  headline text,
  source_url text,
  source_type text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, ctwa_clid)
);

CREATE INDEX attributions_conversation_idx ON public.attributions (conversation_id);
CREATE INDEX attributions_ad_idx ON public.attributions (client_id, ad_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attributions TO authenticated;
GRANT ALL ON public.attributions TO service_role;
ALTER TABLE public.attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attributions select" ON public.attributions FOR SELECT TO authenticated
  USING (public.owns_client(client_id));
CREATE POLICY "attributions insert" ON public.attributions FOR INSERT TO authenticated
  WITH CHECK (public.owns_client(client_id));
CREATE POLICY "attributions update" ON public.attributions FOR UPDATE TO authenticated
  USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "attributions delete" ON public.attributions FOR DELETE TO authenticated
  USING (public.owns_client(client_id));

-- =========================================================
-- 5. Conversation outcomes (one row per conversation)
-- =========================================================
CREATE TABLE public.conversation_outcomes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'unanswered'
    CHECK (status IN ('unanswered', 'answered', 'qualified', 'closed')),
  value_clp numeric,
  marked_by uuid,
  marked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id)
);

CREATE INDEX conversation_outcomes_client_status_idx
  ON public.conversation_outcomes (client_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_outcomes TO authenticated;
GRANT ALL ON public.conversation_outcomes TO service_role;
ALTER TABLE public.conversation_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversation_outcomes select" ON public.conversation_outcomes FOR SELECT TO authenticated
  USING (public.owns_client(client_id));
CREATE POLICY "conversation_outcomes insert" ON public.conversation_outcomes FOR INSERT TO authenticated
  WITH CHECK (public.owns_client(client_id) AND marked_by = auth.uid());
CREATE POLICY "conversation_outcomes update" ON public.conversation_outcomes FOR UPDATE TO authenticated
  USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "conversation_outcomes delete" ON public.conversation_outcomes FOR DELETE TO authenticated
  USING (public.owns_client(client_id));

CREATE TRIGGER t_conversation_outcomes_u BEFORE UPDATE ON public.conversation_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Value only makes sense for closed conversations (trigger, not CHECK)
CREATE OR REPLACE FUNCTION public.validate_conversation_outcome()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'closed' THEN NEW.value_clp := NULL; END IF;
  IF NEW.value_clp IS NOT NULL AND NEW.value_clp < 0 THEN
    RAISE EXCEPTION 'value_clp must be positive';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER t_conversation_outcomes_validate
  BEFORE INSERT OR UPDATE ON public.conversation_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.validate_conversation_outcome();

-- =========================================================
-- 6. Daily Meta insights ingestion job
-- =========================================================
SELECT cron.schedule(
  'meta_insights_daily',
  '20 6 * * *',
  $cron$SELECT public.run_http_cron_job(
    'meta_insights_daily',
    'https://project--e7caaa14-14c5-42d8-b5b5-4cde48ca5360.lovable.app/api/public/meta/ingest-daily'
  );$cron$
);