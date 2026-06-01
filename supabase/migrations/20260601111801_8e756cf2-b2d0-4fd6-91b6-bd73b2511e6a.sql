DO $$
BEGIN
  PERFORM cron.unschedule('whatsapp_dispatch_tick');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'whatsapp_dispatch_tick',
  '20 seconds',
  $$
  SELECT net.http_post(
    url := 'https://project--e7caaa14-14c5-42d8-b5b5-4cde48ca5360-dev.lovable.app/api/public/whatsapp/dispatch',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
  $$
);