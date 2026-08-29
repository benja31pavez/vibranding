CREATE OR REPLACE FUNCTION public.ensure_org()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE uid uuid := auth.uid(); oid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT m.org_id INTO oid FROM public.org_members m WHERE m.user_id = uid LIMIT 1;
  IF oid IS NOT NULL THEN RETURN oid; END IF;
  INSERT INTO public.orgs (name, owner_user_id) VALUES ('Mi organización', uid) RETURNING id INTO oid;
  INSERT INTO public.org_members (org_id, user_id, role) VALUES (oid, uid, 'owner');
  RETURN oid;
END $$;

REVOKE EXECUTE ON FUNCTION public.ensure_org() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_org() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.user_orgs() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.user_orgs() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_manager(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_org_manager(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.manages_client(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.manages_client(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.user_client_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.user_client_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.client_analytics_guard(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.client_analytics_guard(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.owns_client(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.owns_client(uuid) TO authenticated;
