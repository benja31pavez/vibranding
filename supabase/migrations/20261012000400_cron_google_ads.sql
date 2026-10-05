-- =====================================================================
-- Ingesta diaria de Google Ads (google_ads_insights_daily)
--
-- /api/public/google/ingest-daily procesa UN lote de cuentas conectadas por
-- llamada (?offset=&limit=, máximo 8, concurrencia 3) porque
-- public.run_http_cron_job corta la petición a los 15 s. Cada llamada vuelve a
-- descargar los últimos 3 días (Google ajusta conversiones con retraso) con
-- upsert idempotente por (client_id, campaign_id, date).
--
-- Un job por lote, separados 3 minutos, después de la ingesta de Meta
-- (06:20 UTC) y antes de las alertas (13:00 UTC):
--
--   google_ads_ingest_0    06:40 UTC  cuentas 1–8
--   google_ads_ingest_8    06:43 UTC  cuentas 9–16
--   google_ads_ingest_16   06:46 UTC  cuentas 17–24
--
-- Si un lote no tiene cuentas responde accounts = 0 y no hace nada. Si faltan
-- las variables GOOGLE_ADS_* responde 200 con skipped (no es un fallo).
--
-- Más de 24 cuentas: copia un bloque con el siguiente offset (24, 32, …),
-- suma 3 minutos y usa el nombre google_ads_ingest_<offset>. Si job_runs
-- muestra next_offset distinto de null en el último lote, faltan jobs.
--
-- Idempotente: cron.schedule con un nombre existente actualiza ese job en vez
-- de crear otro. No crea tablas: google_ads_accounts y
-- google_ads_insights_daily existen desde platform_v2.
-- =====================================================================
SELECT cron.schedule('google_ads_ingest_0', '40 6 * * *',
  $cron$SELECT public.run_http_cron_job('google_ads_ingest_0',
    'https://vibranding.pro/api/public/google/ingest-daily?offset=0&limit=8');$cron$);

SELECT cron.schedule('google_ads_ingest_8', '43 6 * * *',
  $cron$SELECT public.run_http_cron_job('google_ads_ingest_8',
    'https://vibranding.pro/api/public/google/ingest-daily?offset=8&limit=8');$cron$);

SELECT cron.schedule('google_ads_ingest_16', '46 6 * * *',
  $cron$SELECT public.run_http_cron_job('google_ads_ingest_16',
    'https://vibranding.pro/api/public/google/ingest-daily?offset=16&limit=8');$cron$);
