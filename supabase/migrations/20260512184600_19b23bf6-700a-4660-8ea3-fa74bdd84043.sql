
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.owns_client(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_ig_profile_for_client() FROM PUBLIC, anon, authenticated;
