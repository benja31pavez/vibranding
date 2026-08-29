CREATE OR REPLACE FUNCTION public.job_health()
RETURNS TABLE (
  job_name text,
  active boolean,
  schedule text,
  last_run timestamptz,
  last_success timestamptz,
  failed_24h bigint,
  total_24h bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH names AS (
    SELECT j.jobname::text AS job_name, j.active, j.schedule::text AS schedule FROM cron.job j
    UNION
    SELECT DISTINCT r.job_name, NULL::boolean, NULL::text FROM public.job_runs r
    WHERE r.job_name NOT IN (SELECT jobname::text FROM cron.job)
  )
  SELECT n.job_name,
         n.active,
         n.schedule,
         (SELECT max(started_at) FROM public.job_runs r WHERE r.job_name = n.job_name),
         (SELECT max(started_at) FROM public.job_runs r WHERE r.job_name = n.job_name AND r.status = 'succeeded'),
         (SELECT count(*) FROM public.job_runs r WHERE r.job_name = n.job_name AND r.status = 'failed' AND r.started_at > now() - interval '24 hours'),
         (SELECT count(*) FROM public.job_runs r WHERE r.job_name = n.job_name AND r.started_at > now() - interval '24 hours')
  FROM names n
  ORDER BY n.job_name;
$$;

REVOKE ALL ON FUNCTION public.job_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_health() TO service_role;