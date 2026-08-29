-- lovable-cron-fallback-reviewed: 4320 runs/day; restores the pre-existing 20s WhatsApp reply latency (repair, not new cadence); reconciliation folded into the same job so only one recurring job exists
CREATE TABLE IF NOT EXISTS public.job_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name text NOT NULL,
  request_id bigint,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  http_status integer,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_runs_job_started_idx ON public.job_runs (job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS job_runs_status_idx ON public.job_runs (status);

-- Infrastructure log: no tenant column, no client access at all.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_runs TO service_role;
REVOKE ALL ON public.job_runs FROM anon, authenticated;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: anon/authenticated can never read or write this table.

CREATE OR REPLACE FUNCTION public.reconcile_job_runs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.job_runs jr
  SET status = CASE WHEN r.status_code BETWEEN 200 AND 299 THEN 'succeeded' ELSE 'failed' END,
      http_status = r.status_code,
      error = CASE
        WHEN r.status_code BETWEEN 200 AND 299 THEN NULL
        ELSE left(coalesce(r.error_msg, r.content, 'HTTP ' || coalesce(r.status_code::text, '?')), 500)
      END,
      finished_at = coalesce(r.created, now())
  FROM net._http_response r
  WHERE r.id = jr.request_id AND jr.status = 'running';

  UPDATE public.job_runs
  SET status = 'failed',
      error = 'no HTTP response recorded (timeout)',
      finished_at = now()
  WHERE status = 'running' AND started_at < now() - interval '5 minutes';

  DELETE FROM public.job_runs WHERE started_at < now() - interval '30 days';
END $$;

CREATE OR REPLACE FUNCTION public.run_http_cron_job(_job_name text, _url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE dispatch_secret text; req_id bigint;
BEGIN
  -- Log the outcome of the previous runs first (responses arrive asynchronously).
  PERFORM public.reconcile_job_runs();

  SELECT decrypted_secret INTO dispatch_secret
  FROM vault.decrypted_secrets WHERE name = 'DISPATCH_SECRET';

  IF dispatch_secret IS NULL OR btrim(dispatch_secret) = '' THEN
    INSERT INTO public.job_runs (job_name, status, error, finished_at)
    VALUES (_job_name, 'failed', 'DISPATCH_SECRET is not stored in the vault', now());
    RETURN;
  END IF;

  SELECT net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', dispatch_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  ) INTO req_id;

  INSERT INTO public.job_runs (job_name, request_id, status)
  VALUES (_job_name, req_id, 'running');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.job_runs (job_name, status, error, finished_at)
  VALUES (_job_name, 'failed', left(SQLERRM, 500), now());
END $$;

REVOKE ALL ON FUNCTION public.run_http_cron_job(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_job_runs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_http_cron_job(text, text) TO postgres;
GRANT EXECUTE ON FUNCTION public.reconcile_job_runs() TO postgres, service_role;

SELECT cron.unschedule('whatsapp_ai_dispatch');
SELECT cron.unschedule('whatsapp_dispatch_tick');

SELECT cron.schedule(
  'whatsapp_ai_dispatch',
  '20 seconds',
  $cron$SELECT public.run_http_cron_job(
    'whatsapp_ai_dispatch',
    'https://project--e7caaa14-14c5-42d8-b5b5-4cde48ca5360.lovable.app/api/public/whatsapp/dispatch'
  );$cron$
);