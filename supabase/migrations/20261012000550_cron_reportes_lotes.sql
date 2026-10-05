-- =====================================================================
-- Reporte mensual en 10 lotes de 5 clientes (día 1, 12:00–12:18 UTC).
-- Aplicado en producción el 2026-10-05 (antes había 3 jobs de 15 clientes que
-- pasaban el límite de 15 s de public.run_http_cron_job). Este archivo deja el
-- repo igual a la BD. Idempotente: cron.schedule con nombre existente actualiza.
-- =====================================================================
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly_reports_0' AND command LIKE '%limit=15%') THEN
    PERFORM cron.unschedule('monthly_reports_0');
  END IF;
END
$do$;
SELECT cron.schedule('monthly_reports_0', '0 12 1 * *',
  $cron$SELECT public.run_http_cron_job('monthly_reports_0',
    'https://vibranding.pro/api/public/reports/monthly?offset=0&limit=5');$cron$);
SELECT cron.schedule('monthly_reports_5', '2 12 1 * *',
  $cron$SELECT public.run_http_cron_job('monthly_reports_5',
    'https://vibranding.pro/api/public/reports/monthly?offset=5&limit=5');$cron$);
SELECT cron.schedule('monthly_reports_10', '4 12 1 * *',
  $cron$SELECT public.run_http_cron_job('monthly_reports_10',
    'https://vibranding.pro/api/public/reports/monthly?offset=10&limit=5');$cron$);
SELECT cron.schedule('monthly_reports_15', '6 12 1 * *',
  $cron$SELECT public.run_http_cron_job('monthly_reports_15',
    'https://vibranding.pro/api/public/reports/monthly?offset=15&limit=5');$cron$);
SELECT cron.schedule('monthly_reports_20', '8 12 1 * *',
  $cron$SELECT public.run_http_cron_job('monthly_reports_20',
    'https://vibranding.pro/api/public/reports/monthly?offset=20&limit=5');$cron$);
SELECT cron.schedule('monthly_reports_25', '10 12 1 * *',
  $cron$SELECT public.run_http_cron_job('monthly_reports_25',
    'https://vibranding.pro/api/public/reports/monthly?offset=25&limit=5');$cron$);
SELECT cron.schedule('monthly_reports_30', '12 12 1 * *',
  $cron$SELECT public.run_http_cron_job('monthly_reports_30',
    'https://vibranding.pro/api/public/reports/monthly?offset=30&limit=5');$cron$);
SELECT cron.schedule('monthly_reports_35', '14 12 1 * *',
  $cron$SELECT public.run_http_cron_job('monthly_reports_35',
    'https://vibranding.pro/api/public/reports/monthly?offset=35&limit=5');$cron$);
SELECT cron.schedule('monthly_reports_40', '16 12 1 * *',
  $cron$SELECT public.run_http_cron_job('monthly_reports_40',
    'https://vibranding.pro/api/public/reports/monthly?offset=40&limit=5');$cron$);
SELECT cron.schedule('monthly_reports_45', '18 12 1 * *',
  $cron$SELECT public.run_http_cron_job('monthly_reports_45',
    'https://vibranding.pro/api/public/reports/monthly?offset=45&limit=5&last=1');$cron$);
