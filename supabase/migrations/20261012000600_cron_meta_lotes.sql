-- =====================================================================
-- Ingesta diaria de Meta por lotes + aviso de lotes faltantes
--
-- 1) meta_insights_daily (un solo job a las 06:20 UTC) llamaba a
--    /api/public/meta/ingest-daily sin offset y el endpoint recorría TODAS las
--    cuentas una tras otra (3 s o más cada una), pasando los 15 s de
--    public.run_http_cron_job. Ahora el endpoint procesa UN lote por llamada
--    (?offset=&limit=, máximo 3, orden por id) y hay un job por lote,
--    separados 3 minutos desde la misma hora base (06:20 UTC):
--
--      meta_insights_daily_0    06:20 UTC  cuentas 1–3
--      meta_insights_daily_3    06:23 UTC  cuentas 4–6
--      meta_insights_daily_6    06:26 UTC  cuentas 7–9
--      meta_insights_daily_9    06:29 UTC  cuentas 10–12
--      meta_insights_daily_12   06:32 UTC  cuentas 13–15
--      meta_insights_daily_15   06:35 UTC  cuentas 16–18
--      meta_insights_daily_18   06:38 UTC  cuentas 19–21
--      meta_insights_daily_21   06:41 UTC  cuentas 22–24  (&last=1)
--
-- 2) El ÚLTIMO job de cada serie (Meta, Google Ads, alertas y reportes
--    mensuales) lleva &last=1. Si ese lote responde next_offset distinto de
--    null, el endpoint responde 500 "faltan lotes: agrega un job con offset N"
--    y job_runs lo marca como fallido. Para agregar un lote: copia el último
--    bloque con el offset N, suma 3 minutos, y quita &last=1 del anterior.
--
-- Aplicar DESPUÉS de desplegar el código: el endpoint viejo de Meta ignora
-- offset/limit y cada uno de los 8 jobs recorrería todas las cuentas.
--
-- Idempotente: el unschedule va protegido con EXISTS y cron.schedule con un
-- nombre existente actualiza ese job en vez de crear otro. No crea tablas.
-- =====================================================================
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'meta_insights_daily') THEN
    PERFORM cron.unschedule('meta_insights_daily');
  END IF;
END
$do$;

SELECT cron.schedule('meta_insights_daily_0', '20 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_insights_daily_0',
    'https://vibranding.pro/api/public/meta/ingest-daily?offset=0&limit=3');$cron$);

SELECT cron.schedule('meta_insights_daily_3', '23 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_insights_daily_3',
    'https://vibranding.pro/api/public/meta/ingest-daily?offset=3&limit=3');$cron$);

SELECT cron.schedule('meta_insights_daily_6', '26 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_insights_daily_6',
    'https://vibranding.pro/api/public/meta/ingest-daily?offset=6&limit=3');$cron$);

SELECT cron.schedule('meta_insights_daily_9', '29 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_insights_daily_9',
    'https://vibranding.pro/api/public/meta/ingest-daily?offset=9&limit=3');$cron$);

SELECT cron.schedule('meta_insights_daily_12', '32 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_insights_daily_12',
    'https://vibranding.pro/api/public/meta/ingest-daily?offset=12&limit=3');$cron$);

SELECT cron.schedule('meta_insights_daily_15', '35 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_insights_daily_15',
    'https://vibranding.pro/api/public/meta/ingest-daily?offset=15&limit=3');$cron$);

SELECT cron.schedule('meta_insights_daily_18', '38 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_insights_daily_18',
    'https://vibranding.pro/api/public/meta/ingest-daily?offset=18&limit=3');$cron$);

SELECT cron.schedule('meta_insights_daily_21', '41 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_insights_daily_21',
    'https://vibranding.pro/api/public/meta/ingest-daily?offset=21&limit=3&last=1');$cron$);

-- Últimos jobs de las series existentes: mismo nombre y horario, ahora con &last=1.
-- campaign_alerts_32 (20261012000100_cron_alertas)
SELECT cron.schedule('campaign_alerts_32', '12 13 * * *',
  $cron$SELECT public.run_http_cron_job('campaign_alerts_32',
    'https://vibranding.pro/api/public/alerts/run?offset=32&limit=8&last=1');$cron$);

-- google_ads_ingest_16 (20261012000400_cron_google_ads)
SELECT cron.schedule('google_ads_ingest_16', '46 6 * * *',
  $cron$SELECT public.run_http_cron_job('google_ads_ingest_16',
    'https://vibranding.pro/api/public/google/ingest-daily?offset=16&limit=8&last=1');$cron$);

-- Reporte mensual: en producción corre en 10 lotes de 5 (monthly_reports_0..45,
-- ver 20261012000550_cron_reportes_lotes.sql); el último lleva &last=1.
SELECT cron.schedule('monthly_reports_45', '18 12 1 * *',
  $cron$SELECT public.run_http_cron_job('monthly_reports_45',
    'https://vibranding.pro/api/public/reports/monthly?offset=45&limit=5&last=1');$cron$);
