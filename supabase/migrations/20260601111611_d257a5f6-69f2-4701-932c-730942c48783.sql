REVOKE ALL ON FUNCTION public.schedule_whatsapp_ai_reply() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_whatsapp_ai_reply() FROM anon;
REVOKE ALL ON FUNCTION public.schedule_whatsapp_ai_reply() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_whatsapp_ai_reply() TO service_role;