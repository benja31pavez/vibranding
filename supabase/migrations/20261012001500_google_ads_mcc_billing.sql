-- =====================================================================
-- Google Ads: conexión única de la agencia (MCC) + estado de facturación
--
-- 1. google_ads_agency_connection: UNA conexión por organización con la
--    cuenta administradora (MCC) de la agencia. El refresh token vive en
--    Vault; la tabla solo guarda token_secret_id. Miembros de la org leen;
--    solo el servidor (service_role) escribe.
-- 2. google_ads_accounts.auth_source: 'cliente' (token propio del cliente,
--    comportamiento anterior, sigue funcionando) o 'agencia' (usa el token de
--    la MCC de la agencia y login-customer-id = MCC). Desde el navegador no se
--    puede cambiar (trigger guard).
-- 3. google_ads_billing_status: último estado de facturación por cliente
--    (customer.status + billing_setup + account_budget). Lo escribe el job
--    diario 'google_ads_billing_<offset>'. RLS: miembros (owns_client) leen;
--    solo service_role escribe.
-- 4. campaign_alerts.kind no tiene CHECK: el tipo 'billing_google' no
--    requiere cambio de constraint (platform = 'google' ya está permitido).
-- 5. Jobs de cron del chequeo de facturación (después de la ingesta).
--
-- Aditiva e idempotente: se puede re-ejecutar. Nada se borra ni se renombra.
-- Cómo se aplica: pegarla completa en el SQL editor de Supabase (una sola
-- transacción) DESPUÉS de 20261012000400_cron_google_ads.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Conexión de la agencia (MCC)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_ads_agency_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  -- MCC elegida; null mientras status = 'pendiente' (la cuenta Google ve varias MCC).
  manager_customer_id text,
  manager_name text,
  token_secret_id uuid,
  connected_by uuid,
  status text NOT NULL DEFAULT 'pendiente',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_ads_agency_connection_org_uk UNIQUE (org_id),
  CONSTRAINT google_ads_agency_connection_manager_chk
    CHECK (manager_customer_id IS NULL OR manager_customer_id ~ '^[0-9]{10}$'),
  CONSTRAINT google_ads_agency_connection_status_chk
    CHECK (status IN ('pendiente', 'conectada', 'error')),
  CONSTRAINT google_ads_agency_connection_ready_chk
    CHECK (status <> 'conectada' OR manager_customer_id IS NOT NULL)
);

REVOKE ALL ON public.google_ads_agency_connection FROM anon, authenticated;
GRANT SELECT ON public.google_ads_agency_connection TO authenticated;
GRANT ALL ON public.google_ads_agency_connection TO service_role;
ALTER TABLE public.google_ads_agency_connection ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_ads_agency_connection select" ON public.google_ads_agency_connection;
CREATE POLICY "google_ads_agency_connection select" ON public.google_ads_agency_connection
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));
-- Sin políticas de INSERT/UPDATE/DELETE: solo service_role (servidor) escribe.

DROP TRIGGER IF EXISTS t_google_ads_agency_connection_u ON public.google_ads_agency_connection;
CREATE TRIGGER t_google_ads_agency_connection_u BEFORE UPDATE ON public.google_ads_agency_connection
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Accesores Vault (solo service_role), mismo patrón que google_ads_get/set_secret.
CREATE OR REPLACE FUNCTION public.google_ads_agency_get_secret(_org_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE sid uuid; val text;
BEGIN
  SELECT token_secret_id INTO sid FROM public.google_ads_agency_connection WHERE org_id = _org_id;
  IF sid IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO val FROM vault.decrypted_secrets WHERE id = sid;
  RETURN val;
END $$;

CREATE OR REPLACE FUNCTION public.google_ads_agency_set_secret(_org_id uuid, _secret text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE sid uuid;
BEGIN
  SELECT token_secret_id INTO sid FROM public.google_ads_agency_connection WHERE org_id = _org_id;

  IF _secret IS NULL OR btrim(_secret) = '' THEN
    IF sid IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = sid; END IF;
    UPDATE public.google_ads_agency_connection SET token_secret_id = NULL WHERE org_id = _org_id;
    RETURN NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.google_ads_agency_connection WHERE org_id = _org_id) THEN
    RAISE EXCEPTION 'No existe la conexión de la agencia para esta organización';
  END IF;

  IF sid IS NULL THEN
    sid := vault.create_secret(_secret, 'google_ads_agency_refresh_token_' || _org_id::text,
      'Google Ads OAuth refresh token (MCC de la agencia)');
    UPDATE public.google_ads_agency_connection SET token_secret_id = sid WHERE org_id = _org_id;
  ELSE
    PERFORM vault.update_secret(sid, _secret);
  END IF;
  RETURN sid;
END $$;

REVOKE ALL ON FUNCTION public.google_ads_agency_get_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.google_ads_agency_set_secret(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.google_ads_agency_get_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_ads_agency_set_secret(uuid, text) TO service_role;

-- ---------------------------------------------------------------------
-- 2. google_ads_accounts.auth_source
-- ---------------------------------------------------------------------
ALTER TABLE public.google_ads_accounts
  ADD COLUMN IF NOT EXISTS auth_source text NOT NULL DEFAULT 'cliente';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'google_ads_accounts_auth_source_chk'
      AND conrelid = 'public.google_ads_accounts'::regclass
  ) THEN
    ALTER TABLE public.google_ads_accounts
      ADD CONSTRAINT google_ads_accounts_auth_source_chk CHECK (auth_source IN ('cliente', 'agencia'));
  END IF;
END $$;

-- Desde el navegador no se puede pasar una cuenta al token de la agencia.
CREATE OR REPLACE FUNCTION public.guard_google_ads_auth_source()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND ((TG_OP = 'INSERT' AND NEW.auth_source <> 'cliente')
          OR (TG_OP = 'UPDATE' AND NEW.auth_source IS DISTINCT FROM OLD.auth_source)) THEN
    RAISE EXCEPTION 'auth_source solo lo cambia el servidor';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_google_ads_auth_source() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_google_ads_accounts_auth_source_guard ON public.google_ads_accounts;
CREATE TRIGGER t_google_ads_accounts_auth_source_guard BEFORE INSERT OR UPDATE ON public.google_ads_accounts
  FOR EACH ROW EXECUTE FUNCTION public.guard_google_ads_auth_source();

-- ---------------------------------------------------------------------
-- 3. Estado de facturación por cliente (último chequeo)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_ads_billing_status (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  customer_id text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  -- Último chequeo que SÍ obtuvo respuesta de Google (el gate exige que sea reciente).
  last_success_at timestamptz,
  -- customer.status: ENABLED / CANCELED / SUSPENDED / CLOSED …
  customer_status text,
  -- Mejor billing_setup.status: APPROVED / APPROVED_HELD / PENDING / CANCELLED / NONE
  billing_status text,
  has_valid_billing boolean NOT NULL DEFAULT false,
  -- verificado / pendiente / rechazado / sin_cuenta
  verdict text NOT NULL DEFAULT 'sin_cuenta',
  payments_account_name text,
  -- account_budget aprobado (solo cuentas CLP; null si no hay límite)
  budget_limit_clp bigint,
  budget_served_clp bigint,
  budget_end_at text,
  detail text,
  check_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_ads_billing_status_customer_chk
    CHECK (customer_id IS NULL OR customer_id ~ '^[0-9]{10}$'),
  CONSTRAINT google_ads_billing_status_verdict_chk
    CHECK (verdict IN ('verificado', 'pendiente', 'rechazado', 'sin_cuenta')),
  CONSTRAINT google_ads_billing_status_valid_chk
    CHECK (NOT has_valid_billing OR verdict = 'verificado')
);

REVOKE ALL ON public.google_ads_billing_status FROM anon, authenticated;
GRANT SELECT ON public.google_ads_billing_status TO authenticated;
GRANT ALL ON public.google_ads_billing_status TO service_role;
ALTER TABLE public.google_ads_billing_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_ads_billing_status select" ON public.google_ads_billing_status;
CREATE POLICY "google_ads_billing_status select" ON public.google_ads_billing_status
  FOR SELECT TO authenticated USING (public.owns_client(client_id));
-- Sin políticas de escritura: solo service_role.

DROP TRIGGER IF EXISTS t_google_ads_billing_status_u ON public.google_ads_billing_status;
CREATE TRIGGER t_google_ads_billing_status_u BEFORE UPDATE ON public.google_ads_billing_status
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 4. Jobs del chequeo de facturación
--
-- /api/public/google/billing-check procesa UN lote de cuentas por llamada
-- (?offset=&limit=, máximo 8) con x-dispatch-secret (run_http_cron_job).
-- Después de la ingesta (06:40–06:46 UTC) y antes de las alertas (13:00):
--
--   google_ads_billing_0    07:00 UTC  cuentas 1–8
--   google_ads_billing_8    07:03 UTC  cuentas 9–16
--   google_ads_billing_16   07:06 UTC  cuentas 17–24 (&last=1)
--
-- El último lleva &last=1: si aún quedan cuentas responde 500 ("faltan
-- lotes"). Para más de 24 cuentas copia un bloque con el siguiente offset,
-- suma 3 minutos y mueve &last=1 al nuevo último job.
-- cron.schedule con un nombre existente actualiza ese job (idempotente).
-- ---------------------------------------------------------------------
SELECT cron.schedule('google_ads_billing_0', '0 7 * * *',
  $cron$SELECT public.run_http_cron_job('google_ads_billing_0',
    'https://vibranding.pro/api/public/google/billing-check?offset=0&limit=8');$cron$);

SELECT cron.schedule('google_ads_billing_8', '3 7 * * *',
  $cron$SELECT public.run_http_cron_job('google_ads_billing_8',
    'https://vibranding.pro/api/public/google/billing-check?offset=8&limit=8');$cron$);

SELECT cron.schedule('google_ads_billing_16', '6 7 * * *',
  $cron$SELECT public.run_http_cron_job('google_ads_billing_16',
    'https://vibranding.pro/api/public/google/billing-check?offset=16&limit=8&last=1');$cron$);
