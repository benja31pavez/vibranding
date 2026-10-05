-- =====================================================================
-- Limpieza del onboarding en dos fases (reemplaza el flujo de
-- cleanup_onboarding_orphans(), que se mantiene como respaldo).
-- =====================================================================
-- Problema: cleanup_onboarding_orphans() borraba las reservas vencidas ANTES
-- de que el job borrara los archivos de Storage. Si storage.remove fallaba o
-- la corrida se cortaba por tope de lotes, esos archivos (con datos
-- personales) quedaban sin reserva y solo los recogía el barrido
-- 'sin_reserva'. Ahora:
--   1. list_onboarding_orphans(_limit) lista, SIN borrar nada:
--        - 'reserva_vencida': reservas no usadas de más de 48 h cuyo token ya
--          no está vigente (mismo criterio que antes);
--        - 'sin_reserva': objetos del bucket 'onboarding' de más de 48 h sin
--          ninguna reserva Y sin referencia en client_intake.archivos (un
--          archivo citado por un formulario enviado nunca se barre).
--   2. El job borra esos paths de Storage.
--   3. delete_onboarding_reservations(_paths) borra las reservas SOLO de los
--      paths que Storage confirmó. Re-valida el criterio (no usada, > 48 h,
--      token no vigente), así que es idempotente y no puede borrar una
--      reserva viva aunque reciba un path equivocado.
-- Si el paso 3 falla, la reserva sigue ahí y la próxima corrida la vuelve a
-- listar; storage.remove de un archivo ya borrado no es error.
-- Ambas: SECURITY DEFINER, search_path = '', solo service_role.

CREATE OR REPLACE FUNCTION public.list_onboarding_orphans(_limit integer DEFAULT 2000)
RETURNS TABLE (path text, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  lim integer := LEAST(GREATEST(COALESCE(_limit, 2000), 1), 5000);
  n integer;
BEGIN
  RETURN QUERY
  SELECT r.path, 'reserva_vencida'::text
  FROM public.onboarding_upload_reservations r
  WHERE NOT r.used
    AND r.created_at < now() - interval '48 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.client_billing b
      WHERE b.client_id = r.client_id
        AND b.onboarding_token = r.token
        AND b.onboarding_token_expires_at IS NOT NULL
        AND b.onboarding_token_expires_at >= now())
    AND NOT EXISTS (
      SELECT 1 FROM public.client_intake ci, LATERAL unnest(ci.archivos) AS a(p) WHERE a.p = r.path)
  ORDER BY r.created_at
  LIMIT lim;

  GET DIAGNOSTICS n = ROW_COUNT;
  IF n >= lim OR to_regclass('storage.objects') IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT o.name::text, 'sin_reserva'::text
  FROM storage.objects o
  WHERE o.bucket_id = 'onboarding'
    AND o.created_at < now() - interval '48 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.onboarding_upload_reservations r WHERE r.path = o.name)
    AND NOT EXISTS (
      SELECT 1 FROM public.client_intake ci, LATERAL unnest(ci.archivos) AS a(p) WHERE a.p = o.name)
  ORDER BY o.created_at
  LIMIT lim - n;
END $$;
REVOKE ALL ON FUNCTION public.list_onboarding_orphans(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_onboarding_orphans(integer) TO service_role;

-- Devuelve cuántas reservas borró. Paths que ya no existen o que no cumplen
-- el criterio de vencida se ignoran (idempotente).
CREATE OR REPLACE FUNCTION public.delete_onboarding_reservations(_paths text[])
RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  n integer;
BEGIN
  IF _paths IS NULL OR cardinality(_paths) = 0 THEN
    RETURN 0;
  END IF;
  IF cardinality(_paths) > 5000 THEN
    RAISE EXCEPTION 'delete_onboarding_reservations: máximo 5000 paths por llamada'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  DELETE FROM public.onboarding_upload_reservations r
   WHERE r.path = ANY (_paths)
     AND NOT r.used
     AND r.created_at < now() - interval '48 hours'
     AND NOT EXISTS (
       SELECT 1 FROM public.client_billing b
       WHERE b.client_id = r.client_id
         AND b.onboarding_token = r.token
         AND b.onboarding_token_expires_at IS NOT NULL
         AND b.onboarding_token_expires_at >= now())
     AND NOT EXISTS (
       SELECT 1 FROM public.client_intake ci, LATERAL unnest(ci.archivos) AS a(p) WHERE a.p = r.path);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.delete_onboarding_reservations(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_onboarding_reservations(text[]) TO service_role;
