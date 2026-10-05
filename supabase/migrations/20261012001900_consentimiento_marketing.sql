-- =====================================================================
-- Consentimiento de marketing separado (formulario /diagnostico)
-- =====================================================================
-- Ley 19.628 / 21.719 (datos personales) y Ley 19.496 art. 28 B (comunicaciones
-- promocionales): el permiso para enviar novedades por correo es opcional,
-- desmarcado por defecto e independiente del consentimiento para recibir el
-- diagnóstico. Idempotente: se puede re-ejecutar. RLS sin cambios.
--
-- 1. prospect_consents.purpose: 'diagnostico' (default, filas existentes) o
--    'marketing'. `channel` sigue diciendo DÓNDE se dio ('web_diagnostico');
--    `purpose` dice PARA QUÉ. Cada consentimiento es su propia fila con el texto
--    y la versión exactos + consented_at.
-- 2. prospects.marketing_opt_in (default false) + marketing_opt_in_at: lo marca
--    solo el servidor tras registrar la fila de marketing. Un prospecto en
--    estado 'baja' cuenta siempre como sin permiso, aunque el flag sea true.

ALTER TABLE public.prospect_consents
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'diagnostico';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'prospect_consents_purpose_chk'
       AND conrelid = 'public.prospect_consents'::regclass
  ) THEN
    ALTER TABLE public.prospect_consents
      ADD CONSTRAINT prospect_consents_purpose_chk CHECK (purpose IN ('diagnostico', 'marketing'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS prospect_consents_purpose_idx
  ON public.prospect_consents (org_id, purpose, consented_at DESC);

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz;

COMMENT ON COLUMN public.prospects.marketing_opt_in IS
  'Aceptó correos de marketing (fila purpose=marketing en prospect_consents). Estado baja = sin permiso siempre.';
