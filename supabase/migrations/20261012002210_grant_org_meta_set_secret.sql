-- =====================================================================
-- org_meta_set_secret vuelve a estar disponible para usuarios autenticados.
-- =====================================================================
-- 20261012002200 la dejó solo para service_role, pero saveOrgMetaToken y
-- clearOrgMetaToken (src/lib/meta/connection.functions.ts) la llaman con la
-- sesión del usuario. La función ya exige is_org_manager(_org_id) por dentro,
-- así que es seguro. anon sigue sin acceso; org_meta_get_secret (lee el
-- token) sigue solo para service_role.
-- Aplicada en producción el 2026-10-06. Re-ejecutable.
-- =====================================================================
GRANT EXECUTE ON FUNCTION public.org_meta_set_secret(uuid, text, timestamptz, text[]) TO authenticated;

NOTIFY pgrst, 'reload schema';
