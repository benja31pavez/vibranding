CREATE OR REPLACE FUNCTION public.safe_jsonb(_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
BEGIN
  IF _text IS NULL OR btrim(_text) = '' THEN RETURN NULL; END IF;
  BEGIN
    RETURN _text::jsonb;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('raw', left(_text, 4000));
  END;
END $function$;

REVOKE ALL ON FUNCTION public.safe_jsonb(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.safe_jsonb(text) TO service_role;

SELECT public.reconcile_job_runs();