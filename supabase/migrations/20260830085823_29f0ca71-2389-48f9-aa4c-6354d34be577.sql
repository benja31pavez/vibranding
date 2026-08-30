ALTER TABLE public.job_runs
  ADD COLUMN IF NOT EXISTS response_body jsonb,
  ADD COLUMN IF NOT EXISTS rows_written integer;

CREATE OR REPLACE FUNCTION public.reconcile_job_runs()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  UPDATE public.job_runs jr
  SET status = CASE
        WHEN r.status_code BETWEEN 200 AND 299 THEN
          CASE
            WHEN coalesce(
                   nullif(regexp_replace(coalesce((public.safe_jsonb(r.content) ->> 'rowsWritten'), ''), '[^0-9-]', '', 'g'), '')::int,
                   -1) = 0
              THEN 'no_data'
            ELSE 'succeeded'
          END
        ELSE 'failed'
      END,
      http_status = r.status_code,
      response_body = public.safe_jsonb(r.content),
      rows_written = nullif(regexp_replace(coalesce((public.safe_jsonb(r.content) ->> 'rowsWritten'), ''), '[^0-9-]', '', 'g'), '')::int,
      error = CASE
        WHEN r.status_code BETWEEN 200 AND 299 THEN NULL
        ELSE left(coalesce(r.error_msg, r.content, 'HTTP ' || coalesce(r.status_code::text, '?')), 2000)
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
END $function$;

CREATE OR REPLACE FUNCTION public.set_job_schedule(_job_name text, _schedule text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE cmd text;
BEGIN
  SELECT j.command INTO cmd FROM cron.job j WHERE j.jobname = _job_name;
  IF cmd IS NULL THEN RETURN false; END IF;
  PERFORM cron.schedule(_job_name, _schedule, cmd);
  RETURN true;
END $function$;

REVOKE ALL ON FUNCTION public.set_job_schedule(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_job_schedule(text, text) TO service_role;

SELECT public.set_job_schedule('whatsapp_ai_dispatch', '*/2 * * * *');