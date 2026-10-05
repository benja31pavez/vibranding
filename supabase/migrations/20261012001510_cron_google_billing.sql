-- =====================================================================
-- Jobs del chequeo diario de facturación de Google Ads
--
-- Aplicar DESPUÉS de publicar el código (la ruta /api/public/google/billing-check
-- debe existir) y después de 20261012001500_google_ads_mcc_billing.sql.
--
-- /api/public/google/billing-check procesa UN lote de cuentas por llamada
-- (?offset=&limit=, máximo 8) con x-dispatch-secret (run_http_cron_job).
-- Después de la ingesta (06:40–06:46 UTC) y antes de las alertas (13:00):
--
--   google_ads_billing_0    07:00 UTC  cuentas 1–8
--   google_ads_billing_8    07:03 UTC  cuentas 9–16
--   google_ads_billing_16   07:06 UTC  cuentas 17–24 (&last=1)
--
-- El último lleva &last=1: si aún quedan cuentas responde 500 ("faltan
-- lotes"). Para más de 24 cuentas copia un bloque con el siguiente offset,
-- suma 3 minutos y mueve &last=1 al nuevo último job.
-- cron.schedule con un nombre existente actualiza ese job (idempotente).
-- =====================================================================
SELECT cron.schedule('google_ads_billing_0', '0 7 * * *',
  $cron$SELECT public.run_http_cron_job('google_ads_billing_0',
    'https://vibranding.pro/api/public/google/billing-check?offset=0&limit=8');$cron$);

SELECT cron.schedule('google_ads_billing_8', '3 7 * * *',
  $cron$SELECT public.run_http_cron_job('google_ads_billing_8',
    'https://vibranding.pro/api/public/google/billing-check?offset=8&limit=8');$cron$);

SELECT cron.schedule('google_ads_billing_16', '6 7 * * *',
  $cron$SELECT public.run_http_cron_job('google_ads_billing_16',
    'https://vibranding.pro/api/public/google/billing-check?offset=16&limit=8&last=1');$cron$);
