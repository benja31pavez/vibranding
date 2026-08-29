-- =========================================================
-- 1. WhatsApp/Meta tokens -> Supabase Vault
-- =========================================================
ALTER TABLE public.whatsapp_accounts
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS access_token_secret_id uuid,
  ADD COLUMN IF NOT EXISTS verify_token_secret_id uuid;

DO $$
DECLARE r record; sid uuid;
BEGIN
  FOR r IN SELECT id, access_token, verify_token FROM public.whatsapp_accounts LOOP
    IF r.access_token IS NOT NULL AND btrim(r.access_token) <> '' THEN
      sid := vault.create_secret(r.access_token, 'wa_access_token_' || r.id::text, 'WhatsApp Cloud API access token');
      UPDATE public.whatsapp_accounts SET access_token_secret_id = sid WHERE id = r.id;
    END IF;
    IF r.verify_token IS NOT NULL AND btrim(r.verify_token) <> '' THEN
      sid := vault.create_secret(r.verify_token, 'wa_verify_token_' || r.id::text, 'WhatsApp webhook verify token');
      UPDATE public.whatsapp_accounts SET verify_token_secret_id = sid WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.whatsapp_accounts
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS verify_token;

-- Server-only accessors (service_role). Never callable from the browser.
CREATE OR REPLACE FUNCTION public.wa_get_secret(_account_id uuid, _kind text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE sid uuid; val text;
BEGIN
  IF _kind = 'access_token' THEN
    SELECT access_token_secret_id INTO sid FROM public.whatsapp_accounts WHERE id = _account_id;
  ELSIF _kind = 'verify_token' THEN
    SELECT verify_token_secret_id INTO sid FROM public.whatsapp_accounts WHERE id = _account_id;
  ELSE
    RAISE EXCEPTION 'invalid secret kind';
  END IF;
  IF sid IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO val FROM vault.decrypted_secrets WHERE id = sid;
  RETURN val;
END $$;

CREATE OR REPLACE FUNCTION public.wa_set_secret(_account_id uuid, _kind text, _secret text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE sid uuid; nm text;
BEGIN
  IF _kind NOT IN ('access_token', 'verify_token') THEN
    RAISE EXCEPTION 'invalid secret kind';
  END IF;
  IF _kind = 'access_token' THEN
    SELECT access_token_secret_id INTO sid FROM public.whatsapp_accounts WHERE id = _account_id;
  ELSE
    SELECT verify_token_secret_id INTO sid FROM public.whatsapp_accounts WHERE id = _account_id;
  END IF;

  IF _secret IS NULL OR btrim(_secret) = '' THEN
    IF sid IS NOT NULL THEN
      DELETE FROM vault.secrets WHERE id = sid;
    END IF;
    IF _kind = 'access_token' THEN
      UPDATE public.whatsapp_accounts SET access_token_secret_id = NULL WHERE id = _account_id;
    ELSE
      UPDATE public.whatsapp_accounts SET verify_token_secret_id = NULL WHERE id = _account_id;
    END IF;
    RETURN NULL;
  END IF;

  IF sid IS NULL THEN
    nm := 'wa_' || _kind || '_' || _account_id::text;
    sid := vault.create_secret(_secret, nm, 'WhatsApp ' || _kind);
    IF _kind = 'access_token' THEN
      UPDATE public.whatsapp_accounts SET access_token_secret_id = sid WHERE id = _account_id;
    ELSE
      UPDATE public.whatsapp_accounts SET verify_token_secret_id = sid WHERE id = _account_id;
    END IF;
  ELSE
    PERFORM vault.update_secret(sid, _secret);
  END IF;
  RETURN sid;
END $$;

REVOKE ALL ON FUNCTION public.wa_get_secret(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wa_set_secret(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_get_secret(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wa_set_secret(uuid, text, text) TO service_role;

-- Non-sensitive projection consumed by the app
CREATE OR REPLACE VIEW public.whatsapp_accounts_safe
WITH (security_invoker = true) AS
SELECT id, client_id, connected, display_phone_number, business_name, profile_photo_url,
       website_url, social_links, catalog, business_hours, timezone,
       ai_enabled, ai_model, ai_system_prompt, ai_business_context,
       ai_debounce_seconds, ai_max_history, waba_id, phone_number_id, last_synced_at,
       (access_token_secret_id IS NOT NULL) AS has_access_token,
       (verify_token_secret_id IS NOT NULL) AS has_verify_token,
       created_at, updated_at
FROM public.whatsapp_accounts;

REVOKE ALL ON public.whatsapp_accounts_safe FROM anon;
GRANT SELECT ON public.whatsapp_accounts_safe TO authenticated;
GRANT SELECT ON public.whatsapp_accounts_safe TO service_role;

-- =========================================================
-- 2. Split FOR ALL policies into per-command policies
-- =========================================================
DROP POLICY IF EXISTS "owner manage booking_settings" ON public.booking_settings;
CREATE POLICY "booking_settings select" ON public.booking_settings FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "booking_settings insert" ON public.booking_settings FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "booking_settings update" ON public.booking_settings FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "booking_settings delete" ON public.booking_settings FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "owner manage bookings" ON public.bookings;
CREATE POLICY "bookings select" ON public.bookings FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "bookings insert" ON public.bookings FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "bookings update" ON public.bookings FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "bookings delete" ON public.bookings FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "owner all bot_knowledge" ON public.bot_knowledge;
CREATE POLICY "bot_knowledge select" ON public.bot_knowledge FOR SELECT TO authenticated USING (public.owns_client(client_id));
CREATE POLICY "bot_knowledge insert" ON public.bot_knowledge FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));
CREATE POLICY "bot_knowledge update" ON public.bot_knowledge FOR UPDATE TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "bot_knowledge delete" ON public.bot_knowledge FOR DELETE TO authenticated USING (public.owns_client(client_id));

DROP POLICY IF EXISTS "owner all lead_meta" ON public.lead_meta;
CREATE POLICY "lead_meta select" ON public.lead_meta FOR SELECT TO authenticated USING (public.owns_client(client_id));
CREATE POLICY "lead_meta insert" ON public.lead_meta FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));
CREATE POLICY "lead_meta update" ON public.lead_meta FOR UPDATE TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "lead_meta delete" ON public.lead_meta FOR DELETE TO authenticated USING (public.owns_client(client_id));

DROP POLICY IF EXISTS "Owner manages client_leads" ON public.client_leads;
CREATE POLICY "client_leads select" ON public.client_leads FOR SELECT TO authenticated USING (public.owns_client(client_id));
CREATE POLICY "client_leads insert" ON public.client_leads FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));
CREATE POLICY "client_leads update" ON public.client_leads FOR UPDATE TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "client_leads delete" ON public.client_leads FOR DELETE TO authenticated USING (public.owns_client(client_id));

DROP POLICY IF EXISTS "owner all landing_pages" ON public.landing_pages;
CREATE POLICY "landing_pages select" ON public.landing_pages FOR SELECT TO authenticated USING (public.owns_client(client_id));
CREATE POLICY "landing_pages insert" ON public.landing_pages FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));
CREATE POLICY "landing_pages update" ON public.landing_pages FOR UPDATE TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "landing_pages delete" ON public.landing_pages FOR DELETE TO authenticated USING (public.owns_client(client_id));

DROP POLICY IF EXISTS "owner all multilinks" ON public.multilinks;
CREATE POLICY "multilinks select" ON public.multilinks FOR SELECT TO authenticated USING (public.owns_client(client_id));
CREATE POLICY "multilinks insert" ON public.multilinks FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));
CREATE POLICY "multilinks update" ON public.multilinks FOR UPDATE TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "multilinks delete" ON public.multilinks FOR DELETE TO authenticated USING (public.owns_client(client_id));

DROP POLICY IF EXISTS "owner all multilink_items" ON public.multilink_items;
CREATE POLICY "multilink_items select" ON public.multilink_items FOR SELECT TO authenticated USING (public.owns_client(client_id));
CREATE POLICY "multilink_items insert" ON public.multilink_items FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));
CREATE POLICY "multilink_items update" ON public.multilink_items FOR UPDATE TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "multilink_items delete" ON public.multilink_items FOR DELETE TO authenticated USING (public.owns_client(client_id));

DROP POLICY IF EXISTS "Users manage own profile" ON public.user_profiles;
CREATE POLICY "user_profiles select" ON public.user_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_profiles insert" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_profiles update" ON public.user_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_profiles delete" ON public.user_profiles FOR DELETE TO authenticated USING (user_id = auth.uid());

-- =========================================================
-- 3. Drop anon privileges on every private table
-- =========================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname NOT IN ('landing_pages','multilinks','multilink_items',
                            'landing_contact_submissions','landing_events',
                            'portfolio_clients','portfolio_works')
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- Public surfaces keep only the minimum they need
REVOKE ALL ON public.landing_pages FROM anon;
REVOKE ALL ON public.multilinks FROM anon;
REVOKE ALL ON public.multilink_items FROM anon;
REVOKE ALL ON public.portfolio_clients FROM anon;
REVOKE ALL ON public.portfolio_works FROM anon;
REVOKE ALL ON public.landing_contact_submissions FROM anon;
REVOKE ALL ON public.landing_events FROM anon;
GRANT SELECT ON public.landing_pages TO anon;
GRANT SELECT ON public.multilinks TO anon;
GRANT SELECT ON public.multilink_items TO anon;
GRANT SELECT ON public.portfolio_clients TO anon;
GRANT SELECT ON public.portfolio_works TO anon;
GRANT INSERT ON public.landing_contact_submissions TO anon;
GRANT INSERT ON public.landing_events TO anon;