ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS meta_token_secret_id uuid,
  ADD COLUMN IF NOT EXISTS meta_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_token_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_token_scopes text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.org_meta_set_secret(_org_id uuid, _secret text, _expires_at timestamptz DEFAULT NULL, _scopes text[] DEFAULT '{}')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE sid uuid; nm text;
BEGIN
  IF NOT public.is_org_manager(_org_id) THEN
    RAISE EXCEPTION 'not authorized for this organization';
  END IF;

  SELECT meta_token_secret_id INTO sid FROM public.orgs WHERE id = _org_id;

  IF _secret IS NULL OR btrim(_secret) = '' THEN
    IF sid IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = sid; END IF;
    UPDATE public.orgs
      SET meta_token_secret_id = NULL, meta_token_expires_at = NULL,
          meta_token_updated_at = NULL, meta_token_scopes = '{}'
      WHERE id = _org_id;
    RETURN NULL;
  END IF;

  IF sid IS NULL THEN
    nm := 'meta_org_token_' || _org_id::text;
    sid := vault.create_secret(_secret, nm, 'Meta System User token (organization)');
  ELSE
    PERFORM vault.update_secret(sid, _secret);
  END IF;

  UPDATE public.orgs
    SET meta_token_secret_id = sid, meta_token_expires_at = _expires_at,
        meta_token_updated_at = now(), meta_token_scopes = coalesce(_scopes, '{}')
    WHERE id = _org_id;
  RETURN sid;
END $$;

REVOKE ALL ON FUNCTION public.org_meta_set_secret(uuid, text, timestamptz, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_meta_set_secret(uuid, text, timestamptz, text[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.org_meta_get_secret(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE sid uuid; val text;
BEGIN
  SELECT meta_token_secret_id INTO sid FROM public.orgs WHERE id = _org_id;
  IF sid IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO val FROM vault.decrypted_secrets WHERE id = sid;
  RETURN val;
END $$;

REVOKE ALL ON FUNCTION public.org_meta_get_secret(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_meta_get_secret(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.org_meta_token_status()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
       'org_id', o.id,
       'org_name', o.name,
       'has_token', o.meta_token_secret_id IS NOT NULL,
       'expires_at', o.meta_token_expires_at,
       'updated_at', o.meta_token_updated_at,
       'scopes', to_jsonb(o.meta_token_scopes),
       'can_manage', public.is_org_manager(o.id)
     )
     FROM public.orgs o
     JOIN public.org_members m ON m.org_id = o.id
     WHERE m.user_id = auth.uid()
     ORDER BY o.created_at
     LIMIT 1),
    jsonb_build_object('has_token', false, 'can_manage', false)
  )
$$;

REVOKE ALL ON FUNCTION public.org_meta_token_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_meta_token_status() TO authenticated, service_role;

-- Client token resolution now falls back to the organization-level token.
CREATE OR REPLACE FUNCTION public.meta_get_secret(_account_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE sid uuid; val text; oid uuid;
BEGIN
  SELECT token_secret_id INTO sid FROM public.meta_accounts WHERE id = _account_id;

  IF sid IS NOT NULL THEN
    SELECT decrypted_secret INTO val FROM vault.decrypted_secrets WHERE id = sid;
    IF val IS NOT NULL AND btrim(val) <> '' THEN RETURN val; END IF;
  END IF;

  SELECT c.org_id INTO oid
  FROM public.meta_accounts a
  JOIN public.clients c ON c.id = a.client_id
  WHERE a.id = _account_id;
  IF oid IS NULL THEN RETURN NULL; END IF;

  SELECT o.meta_token_secret_id INTO sid FROM public.orgs o WHERE o.id = oid;
  IF sid IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO val FROM vault.decrypted_secrets WHERE id = sid;
  RETURN val;
END $$;