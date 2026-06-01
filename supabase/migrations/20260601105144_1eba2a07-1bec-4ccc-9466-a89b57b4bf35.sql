
-- Remove previous job if exists
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'whatsapp_dispatch_tick';

SELECT cron.schedule(
  'whatsapp_dispatch_tick',
  '20 seconds',
  $$
  SELECT net.http_post(
    url := 'https://vibranding.pro/api/public/whatsapp/dispatch',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
  $$
);
