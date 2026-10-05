-- Preferencias personales del usuario (pantalla "Editar perfil" → Preferencias).
-- Aditiva e idempotente: solo agrega dos columnas con valor por defecto y sus CHECK.
-- No cambia RLS: user_profiles ya restringe SELECT/INSERT/UPDATE/DELETE a
-- user_id = auth.uid().
--   * timezone → zona IANA con la que el usuario VE las horas en su panel.
--                Las reglas de negocio (cobros, vencimientos, feriados, cron,
--                reportes, portal y propuestas) siguen en America/Santiago.
--   * language → idioma preferido ('es' | 'en'); hoy solo aplica al sitio público.
-- Moneda (CLP) y formato de fecha (dd-mm-aaaa) siguen fijos: no tienen columna.
-- La UI tolera que esta migración aún no esté aplicada (campos deshabilitados).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Santiago',
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'es';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_timezone_len'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_timezone_len
      CHECK (char_length(timezone) BETWEEN 1 AND 64);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_language_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_language_check
      CHECK (language IN ('es', 'en'));
  END IF;
END $$;

COMMENT ON COLUMN public.user_profiles.timezone IS
  'Zona IANA para mostrar horas en el panel del usuario. Las reglas de negocio siguen en America/Santiago.';
COMMENT ON COLUMN public.user_profiles.language IS
  'Idioma preferido del usuario (es | en). Hoy solo cambia el sitio público; el panel está en español.';
