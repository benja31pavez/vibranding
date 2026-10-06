-- =====================================================================
-- Facturación · documento tributario manual por cobro (boleta / factura)
-- =====================================================================
-- APLICAR ANTES de publicar el código del PR "Facturación: estado de cuenta":
-- la página lee payments.document_path y payments.document_uploaded_at; sin
-- estas columnas la lista de pagos falla.
--
-- Qué hace:
--   1. payments.document_path (text) y payments.document_uploaded_at
--      (timestamptz). El tipo (boleta/factura) usa la columna existente
--      payments.document_type (CHECK ya en ('factura','boleta')).
--   2. CHECK: el path solo puede ser 'documentos/<client_id>/<id>.pdf'
--      (no se puede apuntar a archivos de otro cliente ni del onboarding).
--   3. Escritura SOLO por servidor: el navegador (authenticated) no tiene
--      INSERT/UPDATE sobre estas columnas (grants por columna de
--      20261010000100). La server function uploadPaymentDocument usa
--      service_role tras assertCanEditClient (owner/admin/agent).
--      La lectura sigue la RLS actual de payments (miembros de la org).
--   4. list_onboarding_orphans: no barre los PDFs referenciados por
--      payments.document_path (viven en el bucket privado 'onboarding' bajo
--      'documentos/'). Un PDF sin cobro (cobro eliminado) sí se barre.
--
-- Sin buckets nuevos. Idempotente.
-- =====================================================================

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS document_path text,
  ADD COLUMN IF NOT EXISTS document_uploaded_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_document_path_chk' AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_document_path_chk
      CHECK (
        document_path IS NULL
        OR document_path = 'documentos/' || client_id::text || '/' || id::text || '.pdf'
      );
  END IF;
END $$;

COMMENT ON COLUMN public.payments.document_path IS
  'PDF de la boleta/factura en el bucket privado onboarding: documentos/<client_id>/<id>.pdf. Solo lo escribe el servidor.';
COMMENT ON COLUMN public.payments.document_uploaded_at IS
  'Cuándo se subió el documento tributario. Solo lo escribe el servidor.';

-- Defensa en profundidad: aunque los grants por columna ya las excluyen.
REVOKE INSERT (document_path, document_uploaded_at), UPDATE (document_path, document_uploaded_at)
  ON public.payments FROM anon, authenticated;

-- Limpieza del onboarding: misma función que 20261012000800 + exclusión de
-- los documentos tributarios referenciados por un cobro.
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
    AND NOT EXISTS (
      SELECT 1 FROM public.payments p WHERE p.document_path = o.name)
  ORDER BY o.created_at
  LIMIT lim - n;
END $$;
REVOKE ALL ON FUNCTION public.list_onboarding_orphans(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_onboarding_orphans(integer) TO service_role;

CREATE INDEX IF NOT EXISTS payments_document_path_idx
  ON public.payments (document_path) WHERE document_path IS NOT NULL;
