-- lovable-cron-fallback-reviewed: 720 runs/day; existing WhatsApp AI reply job keeps its 2-minute cadence so replies stay within the debounce window; this change only adds a SQL pre-check so it skips the HTTP call and the run record when nothing is pending
ALTER TABLE public.meta_accounts ADD COLUMN IF NOT EXISTS last_ig_sync_at timestamptz;

CREATE OR REPLACE FUNCTION public.ig_swap_sync_version(_new_id uuid, _old_id uuid, _label text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cid uuid;
BEGIN
  SELECT client_id INTO cid FROM public.instagram_grid_versions WHERE id = _new_id;
  IF cid IS NULL THEN RAISE EXCEPTION 'staged version not found'; END IF;

  DELETE FROM public.instagram_posts
   WHERE version_id = _old_id AND type = 'current' AND ig_media_id IS NOT NULL;
  DELETE FROM public.instagram_grid_versions WHERE id = _old_id AND client_id = cid;
  UPDATE public.instagram_grid_versions SET label = btrim(_label) WHERE id = _new_id;
  RETURN btrim(_label);
END $$;

REVOKE ALL ON FUNCTION public.ig_swap_sync_version(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ig_swap_sync_version(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.ig_swap_sync_version(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.ig_swap_sync_version(uuid, uuid, text) TO service_role;

ALTER TABLE public.landing_contact_submissions ADD COLUMN IF NOT EXISTS ip_hash text;
CREATE INDEX IF NOT EXISTS landing_contact_submissions_rate_idx
  ON public.landing_contact_submissions (landing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS landing_contact_submissions_ip_idx
  ON public.landing_contact_submissions (ip_hash, created_at DESC);

DROP POLICY IF EXISTS "anon insert submissions on published" ON public.landing_contact_submissions;

CREATE OR REPLACE FUNCTION public.submit_landing_contact(
  _landing_id uuid,
  _name text,
  _email text,
  _phone text,
  _message text,
  _ip_hash text,
  _honeypot text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cid uuid; recent_ip int; recent_landing int;
BEGIN
  IF coalesce(btrim(_honeypot), '') <> '' THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT client_id INTO cid FROM public.landing_pages
   WHERE id = _landing_id AND published = true;
  IF cid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  IF coalesce(btrim(_name), '') = '' OR coalesce(btrim(_email), '') = ''
     OR coalesce(btrim(_message), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT count(*) INTO recent_ip FROM public.landing_contact_submissions
   WHERE _ip_hash IS NOT NULL AND ip_hash = _ip_hash
     AND created_at > now() - interval '1 hour';
  SELECT count(*) INTO recent_landing FROM public.landing_contact_submissions
   WHERE landing_id = _landing_id AND created_at > now() - interval '1 hour';

  IF recent_ip >= 5 OR recent_landing >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  INSERT INTO public.landing_contact_submissions
    (landing_id, client_id, name, email, phone, message, ip_hash)
  VALUES (_landing_id, cid, left(btrim(_name), 100), left(btrim(_email), 255),
          nullif(left(btrim(coalesce(_phone, '')), 40), ''), left(btrim(_message), 2000),
          _ip_hash);

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.submit_landing_contact(uuid, text, text, text, text, text, text)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.job_rows_written(_body jsonb)
RETURNS int
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT nullif(regexp_replace(
    coalesce(_body ->> 'rowsWritten', _body ->> 'rows_written',
             _body ->> 'processed', _body ->> 'rows', ''),
    '[^0-9-]', '', 'g'), '')::int
$$;

CREATE OR REPLACE FUNCTION public.reconcile_job_runs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.job_runs jr
  SET status = CASE
        WHEN r.status_code BETWEEN 200 AND 299 THEN
          CASE WHEN coalesce(public.job_rows_written(public.safe_jsonb(r.content)), -1) = 0
            THEN 'no_data' ELSE 'succeeded' END
        ELSE 'failed'
      END,
      http_status = r.status_code,
      response_body = public.safe_jsonb(r.content),
      rows_written = public.job_rows_written(public.safe_jsonb(r.content)),
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
END $$;

CREATE OR REPLACE FUNCTION public.run_whatsapp_ai_dispatch(_job_name text, _url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE pending int;
BEGIN
  PERFORM public.reconcile_job_runs();

  SELECT count(*) INTO pending FROM public.whatsapp_conversations c
   WHERE coalesce(c.ai_paused, false) = false
     AND c.pending_response_at IS NOT NULL
     AND c.pending_response_at <= now();

  IF coalesce(pending, 0) = 0 THEN
    SELECT count(*) INTO pending FROM public.whatsapp_flow_runs fr
     WHERE fr.status = 'active' AND fr.next_run_at IS NOT NULL AND fr.next_run_at <= now();
  END IF;

  IF coalesce(pending, 0) = 0 THEN RETURN; END IF;

  PERFORM public.run_http_cron_job(_job_name, _url);
END $$;

SELECT cron.schedule(
  'whatsapp_ai_dispatch',
  '*/2 * * * *',
  $cron$SELECT public.run_whatsapp_ai_dispatch('whatsapp_ai_dispatch', 'https://vibranding.pro/api/public/whatsapp/dispatch');$cron$
);