-- =====================================================================
-- Seguridad: las funciones que leen/escriben el token de Meta de la org
-- (vault) solo las puede ejecutar el servidor (service_role).
-- =====================================================================
-- Supabase concede EXECUTE a anon/authenticated por defecto en funciones
-- nuevas, así que el REVOKE ... FROM PUBLIC original no bastaba: cualquiera
-- con el org_id podía leer el token de System User. El código solo las llama
-- con supabaseAdmin (src/lib/meta/bulkConnect.functions.ts).
-- org_meta_token_status (solo estado, sin el token) y content_performance
-- (con guard propio) siguen para usuarios autenticados, no para anon.
-- Aplicada en producción el 2026-10-06. Re-ejecutable.
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.org_meta_get_secret(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_meta_get_secret(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.org_meta_set_secret(uuid, text, timestamptz, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_meta_set_secret(uuid, text, timestamptz, text[]) TO service_role;

REVOKE EXECUTE ON FUNCTION public.org_meta_token_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_meta_token_status() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.content_performance(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.content_performance(uuid, date, date) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
