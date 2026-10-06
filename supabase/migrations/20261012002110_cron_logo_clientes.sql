-- =====================================================================
-- Refresco semanal del logo de los clientes desde Instagram (cron por lotes)
--
-- Llama a /api/public/clients/logo-refresh con x-dispatch-secret
-- (run_http_cron_job). Requiere las columnas de 20261012002100_logo_clientes.sql.
-- Aplicar DESPUÉS de publicar el código: el endpoint debe existir.
-- Idempotente: cron.schedule con un nombre existente actualiza ese job.
--
-- Lunes, lotes de 5 clientes (logos de Instagram con más de 7 días y
-- clientes con @ sin logo; los subidos a mano nunca se tocan):
--   client_logo_refresh_0    07:30 UTC  clientes 1–5
--   client_logo_refresh_5    07:32 UTC  clientes 6–10
--   client_logo_refresh_10   07:34 UTC  clientes 11–15
--   client_logo_refresh_15   07:36 UTC  clientes 16–20
--   client_logo_refresh_20   07:38 UTC  clientes 21–25
--   client_logo_refresh_25   07:40 UTC  clientes 26–30  (&last=1)
--
-- Si el último lote deja clientes sin revisar responde 500 "faltan lotes":
-- copia el último bloque con el offset nuevo y quita &last=1 del anterior.
-- =====================================================================
SELECT cron.schedule('client_logo_refresh_0', '30 7 * * 1',
  $cron$SELECT public.run_http_cron_job('client_logo_refresh_0',
    'https://vibranding.pro/api/public/clients/logo-refresh?offset=0&limit=5');$cron$);

SELECT cron.schedule('client_logo_refresh_5', '32 7 * * 1',
  $cron$SELECT public.run_http_cron_job('client_logo_refresh_5',
    'https://vibranding.pro/api/public/clients/logo-refresh?offset=5&limit=5');$cron$);

SELECT cron.schedule('client_logo_refresh_10', '34 7 * * 1',
  $cron$SELECT public.run_http_cron_job('client_logo_refresh_10',
    'https://vibranding.pro/api/public/clients/logo-refresh?offset=10&limit=5');$cron$);

SELECT cron.schedule('client_logo_refresh_15', '36 7 * * 1',
  $cron$SELECT public.run_http_cron_job('client_logo_refresh_15',
    'https://vibranding.pro/api/public/clients/logo-refresh?offset=15&limit=5');$cron$);

SELECT cron.schedule('client_logo_refresh_20', '38 7 * * 1',
  $cron$SELECT public.run_http_cron_job('client_logo_refresh_20',
    'https://vibranding.pro/api/public/clients/logo-refresh?offset=20&limit=5');$cron$);

SELECT cron.schedule('client_logo_refresh_25', '40 7 * * 1',
  $cron$SELECT public.run_http_cron_job('client_logo_refresh_25',
    'https://vibranding.pro/api/public/clients/logo-refresh?offset=25&limit=5&last=1');$cron$);
