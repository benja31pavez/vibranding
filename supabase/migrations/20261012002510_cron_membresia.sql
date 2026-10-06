-- Crons de la membresía autogestionada.
--
-- APLICAR DESPUÉS de publicar el código y de aplicar 20261012002500
-- (el job de seguimiento llama a /api/public/billing/membership-followup).
--
-- 1) membership_refresh: cada día recalcula el estado derivado (fin de período
--    sin renovación → clients.status = 'terminado', MRR 0). Solo SQL.
-- 2) membership_followup_*: correo de seguimiento 3 días antes del fin del
--    período, en lotes de 10 (run_http_cron_job corta a los 15 s). Si algún día
--    hay más de 30 clientes por avisar el mismo día, el último lote responde 500
--    con "faltan lotes": agrega un job con el offset que indique.
-- 3) Ya no hay cobro mensual automático: se desprograma billing_monthly_charges
--    (la tabla subscriptions está vacía, así que no deja de cobrarse nada).

SELECT cron.unschedule(jobid) FROM cron.job
 WHERE jobname IN (
   'membership_refresh',
   'membership_followup_0',
   'membership_followup_10',
   'membership_followup_20',
   'billing_monthly_charges'
 );

SELECT cron.schedule('membership_refresh', '15 4 * * *', $$SELECT public.refresh_client_memberships();$$);

SELECT cron.schedule(
  'membership_followup_0',
  '0 14 * * *',
  $$SELECT public.run_http_cron_job('membership_followup_0', 'https://vibranding.pro/api/public/billing/membership-followup?offset=0&limit=10');$$
);
SELECT cron.schedule(
  'membership_followup_10',
  '2 14 * * *',
  $$SELECT public.run_http_cron_job('membership_followup_10', 'https://vibranding.pro/api/public/billing/membership-followup?offset=10&limit=10');$$
);
SELECT cron.schedule(
  'membership_followup_20',
  '4 14 * * *',
  $$SELECT public.run_http_cron_job('membership_followup_20', 'https://vibranding.pro/api/public/billing/membership-followup?offset=20&limit=10&last=1');$$
);
