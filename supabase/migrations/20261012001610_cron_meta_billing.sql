-- =====================================================================
-- Chequeo diario del pago de pauta en Meta (cron por lotes)
--
-- Llama a /api/public/meta/billing-check con x-dispatch-secret. Requiere la
-- tabla meta_billing_status (20261012001600_onboarding_pago_pauta.sql).
-- Aplicar DESPUÉS de publicar el código: el endpoint debe existir.
-- Idempotente: cron.schedule con un nombre existente actualiza ese job.
--
-- Lotes de 10, después de la ingesta de Meta:
--   meta_billing_check_0    06:50 UTC  cuentas 1–10
--   meta_billing_check_10   06:52 UTC  cuentas 11–20
--   meta_billing_check_20   06:54 UTC  cuentas 21–30  (&last=1)
--
-- Si el último lote deja cuentas sin revisar responde 500 "faltan lotes":
-- copia el último bloque con el offset nuevo y quita &last=1 del anterior.
-- =====================================================================
SELECT cron.schedule('meta_billing_check_0', '50 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_billing_check_0',
    'https://vibranding.pro/api/public/meta/billing-check?offset=0&limit=10');$cron$);

SELECT cron.schedule('meta_billing_check_10', '52 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_billing_check_10',
    'https://vibranding.pro/api/public/meta/billing-check?offset=10&limit=10');$cron$);

SELECT cron.schedule('meta_billing_check_20', '54 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_billing_check_20',
    'https://vibranding.pro/api/public/meta/billing-check?offset=20&limit=10&last=1');$cron$);
