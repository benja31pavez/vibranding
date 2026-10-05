-- =====================================================================
-- Alertas automáticas de campañas (campaign_alerts)
--
-- /api/public/alerts/run evalúa UN lote de clientes por llamada (por defecto
-- 8, concurrencia 3) porque public.run_http_cron_job corta la petición a los
-- 15 s. Por eso hay un job por lote, separados 3 minutos, desde las 13:00 UTC
-- (≈10:00 en Chile; 09:00 en invierno), varias horas después de la ingesta de
-- Meta (meta_insights_daily, 06:20 UTC):
--
--   campaign_alerts_0   13:00  clientes 1–8
--   campaign_alerts_8   13:03  clientes 9–16
--   campaign_alerts_16  13:06  clientes 17–24
--   campaign_alerts_24  13:09  clientes 25–32
--   campaign_alerts_32  13:12  clientes 33–40
--
-- Si un lote no tiene clientes, la llamada responde clients = 0 (rowsWritten 0
-- → job_runs 'no_data') y no hace nada.
--
-- Cómo agregar más lotes (más de 40 clientes activos con Meta conectado):
-- copia un bloque con el siguiente offset (40, 48, …), sube el minuto en 3
-- y usa el nombre campaign_alerts_<offset>. Si respuestas de job_runs muestran
-- next_offset distinto de null en el último lote, faltan jobs.
--
-- Idempotente: cron.schedule con un nombre existente actualiza ese job en vez
-- de crear otro. No crea tablas: campaign_alerts existe desde platform_v2.
-- =====================================================================
SELECT cron.schedule('campaign_alerts_0', '0 13 * * *',
  $cron$SELECT public.run_http_cron_job('campaign_alerts_0',
    'https://vibranding.pro/api/public/alerts/run?offset=0&limit=8');$cron$);

SELECT cron.schedule('campaign_alerts_8', '3 13 * * *',
  $cron$SELECT public.run_http_cron_job('campaign_alerts_8',
    'https://vibranding.pro/api/public/alerts/run?offset=8&limit=8');$cron$);

SELECT cron.schedule('campaign_alerts_16', '6 13 * * *',
  $cron$SELECT public.run_http_cron_job('campaign_alerts_16',
    'https://vibranding.pro/api/public/alerts/run?offset=16&limit=8');$cron$);

SELECT cron.schedule('campaign_alerts_24', '9 13 * * *',
  $cron$SELECT public.run_http_cron_job('campaign_alerts_24',
    'https://vibranding.pro/api/public/alerts/run?offset=24&limit=8');$cron$);

SELECT cron.schedule('campaign_alerts_32', '12 13 * * *',
  $cron$SELECT public.run_http_cron_job('campaign_alerts_32',
    'https://vibranding.pro/api/public/alerts/run?offset=32&limit=8');$cron$);
