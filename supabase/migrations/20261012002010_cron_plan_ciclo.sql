-- =====================================================================
-- Ciclo mensual del plan (cron por lotes, día 25)
--
-- Llama a /api/public/plan/monthly-cycle con x-dispatch-secret (lo agrega
-- public.run_http_cron_job). El día 25 el endpoint crea, para cada cliente
-- activo con plan mensual (Contenido, Crecimiento, Mantención), las tareas del
-- ciclo del mes siguiente (y las del mes actual si faltan). Idempotente.
--
-- Aplicar DESPUÉS de publicar el código (el endpoint debe existir) y de
-- 20261012002000_plan_ciclo_mensual.sql. Re-ejecutable: cron.schedule con un
-- nombre existente actualiza ese job.
--
-- Lotes de 10 clientes, 09:30–09:38 hora de Chile (12:30–12:38 UTC):
--   plan_cycle_0    clientes 1–10
--   plan_cycle_10   clientes 11–20
--   plan_cycle_20   clientes 21–30
--   plan_cycle_30   clientes 31–40
--   plan_cycle_40   clientes 41–50  (&last=1)
--
-- Si el último lote deja clientes sin revisar responde 500 "faltan lotes":
-- copia el último bloque con el offset nuevo y quita &last=1 del anterior.
-- =====================================================================
SELECT cron.schedule('plan_cycle_0', '30 12 25 * *',
  $cron$SELECT public.run_http_cron_job('plan_cycle_0',
    'https://vibranding.pro/api/public/plan/monthly-cycle?offset=0&limit=10');$cron$);

SELECT cron.schedule('plan_cycle_10', '32 12 25 * *',
  $cron$SELECT public.run_http_cron_job('plan_cycle_10',
    'https://vibranding.pro/api/public/plan/monthly-cycle?offset=10&limit=10');$cron$);

SELECT cron.schedule('plan_cycle_20', '34 12 25 * *',
  $cron$SELECT public.run_http_cron_job('plan_cycle_20',
    'https://vibranding.pro/api/public/plan/monthly-cycle?offset=20&limit=10');$cron$);

SELECT cron.schedule('plan_cycle_30', '36 12 25 * *',
  $cron$SELECT public.run_http_cron_job('plan_cycle_30',
    'https://vibranding.pro/api/public/plan/monthly-cycle?offset=30&limit=10');$cron$);

SELECT cron.schedule('plan_cycle_40', '38 12 25 * *',
  $cron$SELECT public.run_http_cron_job('plan_cycle_40',
    'https://vibranding.pro/api/public/plan/monthly-cycle?offset=40&limit=10&last=1');$cron$);
