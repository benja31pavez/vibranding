-- Perfil del dueño y datos de la agencia (pantalla "Editar perfil").
-- Aditiva: solo agrega columnas opcionales. No cambia RLS: ambas tablas ya
-- restringen SELECT/INSERT/UPDATE/DELETE a user_id = auth.uid().
--   * user_profiles   → cargo del usuario (p. ej. "Fundador").
--   * pricing_settings → completa los datos de la agencia que ya usan los
--     contratos (agency_legal_name, agency_tax_id, agency_address, agency_email).
-- La UI tolera que esta migración aún no esté aplicada (campos deshabilitados).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS job_title text;

ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS agency_business_activity text,
  ADD COLUMN IF NOT EXISTS agency_website text,
  ADD COLUMN IF NOT EXISTS agency_instagram text,
  ADD COLUMN IF NOT EXISTS agency_business_hours text;

-- Límites de largo razonables (texto libre escrito por el dueño).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_job_title_len'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_job_title_len
      CHECK (job_title IS NULL OR char_length(job_title) <= 80);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pricing_settings_agency_profile_len'
  ) THEN
    ALTER TABLE public.pricing_settings
      ADD CONSTRAINT pricing_settings_agency_profile_len
      CHECK (
        (agency_business_activity IS NULL OR char_length(agency_business_activity) <= 200)
        AND (agency_website IS NULL OR char_length(agency_website) <= 200)
        AND (agency_instagram IS NULL OR char_length(agency_instagram) <= 60)
        AND (agency_business_hours IS NULL OR char_length(agency_business_hours) <= 200)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.user_profiles.job_title IS 'Cargo del usuario en la agencia (p. ej. Fundador).';
COMMENT ON COLUMN public.pricing_settings.agency_business_activity IS 'Giro comercial de la agencia.';
COMMENT ON COLUMN public.pricing_settings.agency_website IS 'Sitio web de la agencia.';
COMMENT ON COLUMN public.pricing_settings.agency_instagram IS 'Usuario de Instagram de la agencia, sin @.';
COMMENT ON COLUMN public.pricing_settings.agency_business_hours IS 'Horario de atención (texto libre).';
