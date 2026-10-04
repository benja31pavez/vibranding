-- =====================================================================
-- Security hardening (PR fix/seguridad)
--
-- Idempotent: safe to run more than once. The application code in the same
-- PR already enforces every check below on its own; this migration adds the
-- same guarantees at the database level (defence in depth).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. can_edit_client(): owner / admin / agent of the client's org.
--    (owns_client = any member incl. viewer; manages_client = owner/admin)
--    The portal user (client_users) is never an org member, so never passes.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_edit_client(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.org_members m ON m.org_id = c.org_id
    WHERE c.id = _client_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'agent')
  )
$$;
REVOKE ALL ON FUNCTION public.can_edit_client(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_client(uuid) TO authenticated, service_role;


-- ---------------------------------------------------------------------
-- 2. Write policies on sensitive tables.
--    RLS policies are PERMISSIVE (OR-ed): the old generic "ins/upd/del"
--    policies based on owns_client() let a *viewer* write, and on payments
--    they even bypassed the stricter manages_client() policies. We drop every
--    INSERT/UPDATE/DELETE policy on these tables and recreate them.
--    SELECT policies are left untouched.
--      - payments, client_contracts: INSERT = can_edit_client,
--        UPDATE/DELETE = manages_client (owner/admin, as intended before)
--      - meta_accounts, meta_ads_*, whatsapp_accounts: can_edit_client
-- ---------------------------------------------------------------------
DO $$
DECLARE
  t text;
  p record;
  upd_fn text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'payments', 'client_contracts',
    'meta_accounts', 'meta_ads_campaigns', 'meta_ads_adsets', 'meta_ads_ads',
    'whatsapp_accounts'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'security_hardening: table public.% not found, skipped', t;
      CONTINUE;
    END IF;

    FOR p IN
      SELECT policyname, cmd FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    LOOP
      IF p.cmd = 'ALL' THEN
        -- None exist in the repo history; never drop one blindly because it
        -- also grants SELECT. Flag it for manual review instead.
        RAISE WARNING 'security_hardening: FOR ALL policy "%" on public.% left in place, review manually',
          p.policyname, t;
      ELSE
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      END IF;
    END LOOP;

    upd_fn := CASE WHEN t IN ('payments', 'client_contracts') THEN 'manages_client' ELSE 'can_edit_client' END;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_edit_client(client_id))',
      t || ' insert (editor)', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.%I(client_id)) WITH CHECK (public.%I(client_id))',
      t || ' update (editor)', t, upd_fn, upd_fn);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.%I(client_id))',
      t || ' delete (editor)', t, upd_fn);
  END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- 3. One Instagram account per client (meta_accounts.ig_account_id UNIQUE).
--    If duplicates already exist we do NOT fail the migration (that would
--    block every other fix here) and we do NOT pick a winner automatically:
--    a WARNING lists them so they can be fixed by hand, then re-run this file.
--    Empty strings are treated like NULL (not unique-checked).
-- ---------------------------------------------------------------------
DO $$
DECLARE
  dup record;
  has_dups boolean := false;
BEGIN
  FOR dup IN
    SELECT ig_account_id, array_agg(client_id ORDER BY created_at) AS client_ids
    FROM public.meta_accounts
    WHERE ig_account_id IS NOT NULL AND btrim(ig_account_id) <> ''
    GROUP BY ig_account_id
    HAVING count(*) > 1
  LOOP
    has_dups := true;
    RAISE WARNING 'security_hardening: ig_account_id % is linked to several clients: %',
      dup.ig_account_id, dup.client_ids;
  END LOOP;

  IF has_dups THEN
    RAISE WARNING 'security_hardening: UNIQUE index on meta_accounts.ig_account_id NOT created. Unlink the duplicates and run this migration again.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS meta_accounts_ig_account_id_key
      ON public.meta_accounts (ig_account_id)
      WHERE ig_account_id IS NOT NULL AND btrim(ig_account_id) <> '';
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 4. Identity / secret columns are not writable by the authenticated role.
--    Column privileges: table-level INSERT/UPDATE is replaced by a column
--    list that excludes the protected columns. The app writes those columns
--    only from the server with the service role (after an editor check) or
--    through SECURITY DEFINER functions (meta_set_secret, org_meta_set_secret),
--    which are not affected by these grants.
--    NOTE: a column added later to these tables must be granted explicitly
--    to authenticated if the browser needs to write it.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  cols text;
BEGIN
  -- meta_accounts: ad/ig/page ids + vault reference
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'meta_accounts'
    AND column_name NOT IN ('id', 'ig_account_id', 'ad_account_id', 'page_id', 'token_secret_id');
  IF cols IS NOT NULL THEN
    REVOKE INSERT, UPDATE ON public.meta_accounts FROM authenticated;
    EXECUTE format('GRANT INSERT (%s), UPDATE (%s) ON public.meta_accounts TO authenticated', cols, cols);
  END IF;

  -- orgs: org-level Meta token (vault reference + its metadata)
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'orgs'
    AND column_name NOT IN ('id', 'meta_token_secret_id', 'meta_token_expires_at',
                            'meta_token_updated_at', 'meta_token_scopes');
  IF cols IS NOT NULL THEN
    REVOKE INSERT, UPDATE ON public.orgs FROM authenticated;
    EXECUTE format('GRANT INSERT (%s), UPDATE (%s) ON public.orgs TO authenticated', cols, cols);
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 5. submit_landing_contact(): only the server calls it, with the service
--    role (src/lib/landing/contact.functions.ts). The public landing never
--    calls it with the anon key, so anon/authenticated lose EXECUTE: nobody
--    can bypass the server-side IP hashing by calling the RPC directly.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.submit_landing_contact(uuid, text, text, text, text, text, text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.submit_landing_contact(uuid, text, text, text, text, text, text)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.submit_landing_contact(uuid, text, text, text, text, text, text)
      TO service_role;
  END IF;
END $$;


-- ---------------------------------------------------------------------
-- 6. run_whatsapp_ai_dispatch(): flow runs use status 'running'
--    (whatsapp_flow_runs default + src/lib/whatsapp/flow.server.ts), never
--    'active', so due flow steps never woke the dispatcher on their own.
--    CREATE OR REPLACE keeps the existing grants.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_whatsapp_ai_dispatch(_job_name text, _url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE pending int;
BEGIN
  PERFORM public.reconcile_job_runs();

  SELECT count(*) INTO pending FROM public.whatsapp_conversations c
   WHERE coalesce(c.ai_paused, false) = false
     AND c.pending_response_at IS NOT NULL
     AND c.pending_response_at <= now();

  IF coalesce(pending, 0) = 0 THEN
    SELECT count(*) INTO pending FROM public.whatsapp_flow_runs fr
     WHERE fr.status = 'running' AND fr.next_run_at IS NOT NULL AND fr.next_run_at <= now();
  END IF;

  IF coalesce(pending, 0) = 0 THEN RETURN; END IF;

  PERFORM public.run_http_cron_job(_job_name, _url);
END $$;
