-- =====================================================================
-- Alertas automáticas de campañas (campaign_alerts)
--
-- Programa el job diario 'campaign_alerts' a las 13:00 UTC (≈10:00 en Chile,
-- 09:00 en invierno), varias horas después de la ingesta de Meta
-- (meta_insights_daily, 06:20 UTC), para evaluar el día ya cerrado.
-- Llama a /api/public/alerts/run vía public.run_http_cron_job, que agrega el
-- x-dispatch-secret desde el Vault y deja el resultado en job_runs.
--
-- Idempotente: cron.schedule con un nombre existente actualiza ese job en vez
-- de crear otro, así que esta migración puede ejecutarse más de una vez.
-- No crea tablas: campaign_alerts ya existe desde platform_v2.
-- =====================================================================
SELECT cron.schedule(
  'campaign_alerts',
  '0 13 * * *',
  $cron$SELECT public.run_http_cron_job(
    'campaign_alerts',
    'https://vibranding.pro/api/public/alerts/run'
  );$cron$
);
