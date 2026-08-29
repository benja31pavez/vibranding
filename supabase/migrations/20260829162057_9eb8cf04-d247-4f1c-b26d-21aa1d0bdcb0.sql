-- lovable-cron-fallback-reviewed: 4320 runs/day; existing WhatsApp AI debounce dispatcher, unchanged cadence, only its target URL moves to the canonical public origin
SELECT cron.unschedule('whatsapp_ai_dispatch');
SELECT cron.unschedule('meta_insights_daily');

SELECT cron.schedule('whatsapp_ai_dispatch', '20 seconds', $$SELECT public.run_http_cron_job(
    'whatsapp_ai_dispatch',
    'https://vibranding.pro/api/public/whatsapp/dispatch'
  );$$);

SELECT cron.schedule('meta_insights_daily', '20 6 * * *', $$SELECT public.run_http_cron_job(
    'meta_insights_daily',
    'https://vibranding.pro/api/public/meta/ingest-daily'
  );$$);

REVOKE ALL ON public.meta_accounts FROM anon;
REVOKE ALL ON public.ad_insights_daily FROM anon;
REVOKE ALL ON public.post_insights_daily FROM anon;
REVOKE ALL ON public.attributions FROM anon;
REVOKE ALL ON public.conversation_outcomes FROM anon;

REVOKE ALL ON public.meta_accounts FROM authenticated;
REVOKE ALL ON public.ad_insights_daily FROM authenticated;
REVOKE ALL ON public.post_insights_daily FROM authenticated;
REVOKE ALL ON public.attributions FROM authenticated;
REVOKE ALL ON public.conversation_outcomes FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_accounts TO authenticated;
GRANT SELECT ON public.ad_insights_daily TO authenticated;
GRANT SELECT ON public.post_insights_daily TO authenticated;
GRANT SELECT ON public.attributions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_outcomes TO authenticated;

GRANT ALL ON public.meta_accounts TO service_role;
GRANT ALL ON public.ad_insights_daily TO service_role;
GRANT ALL ON public.post_insights_daily TO service_role;
GRANT ALL ON public.attributions TO service_role;
GRANT ALL ON public.conversation_outcomes TO service_role;