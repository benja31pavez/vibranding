-- =====================================================================
-- Diagnóstico gratis (/diagnostico): registro de consentimientos y tope global
-- =====================================================================
-- Idempotente: se puede re-ejecutar.
--
-- 1. prospect_consents: evidencia del consentimiento de contacto (Ley 21.719)
--    en cada envío del formulario público, nuevo o duplicado. Guarda el texto
--    y la versión exactos del checkbox, hash del correo (no el correo en claro)
--    y hash de la IP. Miembros de la org leen; solo service_role escribe.
-- 2. diagnostico_rate + diagnostico_rate_hit(): tope global de envíos por hora
--    (todas las IPs), atómico con INSERT ... ON CONFLICT. Solo service_role.

CREATE TABLE IF NOT EXISTS public.prospect_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  email_hash text NOT NULL,
  channel text NOT NULL DEFAULT 'web_diagnostico',
  consent_text text NOT NULL,
  consent_version text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  CONSTRAINT prospect_consents_channel_chk CHECK (channel IN ('web_diagnostico')),
  CONSTRAINT prospect_consents_text_chk CHECK (btrim(consent_text) <> '' AND btrim(consent_version) <> '')
);

CREATE INDEX IF NOT EXISTS prospect_consents_org_idx ON public.prospect_consents (org_id, consented_at DESC);
CREATE INDEX IF NOT EXISTS prospect_consents_prospect_idx ON public.prospect_consents (prospect_id)
  WHERE prospect_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS prospect_consents_email_idx ON public.prospect_consents (org_id, email_hash);

ALTER TABLE public.prospect_consents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.prospect_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.prospect_consents TO authenticated;
GRANT ALL ON public.prospect_consents TO service_role;

DROP POLICY IF EXISTS "prospect_consents select" ON public.prospect_consents;
CREATE POLICY "prospect_consents select" ON public.prospect_consents
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
-- Sin políticas de INSERT/UPDATE/DELETE: solo service_role (bypass RLS) escribe.

-- ---------------------------------------------------------------------
-- Tope global por hora
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diagnostico_rate (
  bucket_hour timestamptz PRIMARY KEY,
  count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.diagnostico_rate ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.diagnostico_rate FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.diagnostico_rate TO service_role;

-- Suma un envío a la hora actual y devuelve true si sigue bajo _limit.
-- Limpia cubos de más de 2 días para que la tabla no crezca.
CREATE OR REPLACE FUNCTION public.diagnostico_rate_hit(_limit integer)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE bucket timestamptz; n integer;
BEGIN
  IF _limit IS NULL OR _limit < 1 THEN
    RAISE EXCEPTION '_limit debe ser >= 1' USING ERRCODE = '22023';
  END IF;
  bucket := date_trunc('hour', now());
  INSERT INTO public.diagnostico_rate AS r (bucket_hour, count)
  VALUES (bucket, 1)
  ON CONFLICT (bucket_hour) DO UPDATE SET count = r.count + 1
  RETURNING r.count INTO n;
  DELETE FROM public.diagnostico_rate WHERE bucket_hour < bucket - interval '2 days';
  RETURN n <= _limit;
END $$;

REVOKE ALL ON FUNCTION public.diagnostico_rate_hit(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.diagnostico_rate_hit(integer) TO service_role;
