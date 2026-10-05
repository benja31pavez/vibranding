-- =====================================================================
-- Pago de pauta: el cliente paga la publicidad con SU tarjeta en SUS cuentas
-- de Google Ads / Meta. Vibranding nunca cobra la pauta.
--
--   1. client_intake: ads_platforms (dónde va a publicitar) y
--      ads_billing_self_reported ({google: timestamptz|null, meta: ...}),
--      lo que el cliente declara en el paso "Publicidad" del onboarding.
--   2. submit_onboarding(): acepta esas dos claves. Se quitan del payload
--      antes de private.parse_onboarding_payload() (que queda igual) y se
--      validan aparte en private.parse_onboarding_ads(). El resto de la
--      función es la definición de 20261010000000_platform_v3.sql.
--      Sin esta migración el servidor reintenta sin esas claves (tolerante).
--   3. meta_billing_status: último chequeo diario por cuenta publicitaria de
--      Meta (account_status, disable_reason, funding_source_details…). Lee
--      quien es dueño del cliente (owns_client); escribe solo service_role.
--   4. Jobs del cron 'meta_billing_check_<offset>' (06:50 UTC, lotes de 10)
--      → /api/public/meta/billing-check con x-dispatch-secret.
--
-- campaign_alerts.kind no tiene CHECK: el tipo 'billing_meta' no requiere
-- cambios de esquema.
--
-- Aplicar DESPUÉS de desplegar el código (el endpoint del cron debe existir).
-- Idempotente: IF NOT EXISTS, CREATE OR REPLACE, DROP POLICY IF EXISTS y
-- cron.schedule con nombre fijo (actualiza el job si ya existe).
-- =====================================================================


-- =====================================================================
-- 1. client_intake: columnas del paso Publicidad
-- =====================================================================
ALTER TABLE public.client_intake
  ADD COLUMN IF NOT EXISTS ads_platforms text[],
  ADD COLUMN IF NOT EXISTS ads_billing_self_reported jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_intake_ads_platforms_chk') THEN
    ALTER TABLE public.client_intake ADD CONSTRAINT client_intake_ads_platforms_chk
      CHECK (ads_platforms IS NULL OR ads_platforms <@ ARRAY['google', 'meta']::text[]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_intake_ads_reported_chk') THEN
    ALTER TABLE public.client_intake ADD CONSTRAINT client_intake_ads_reported_chk
      CHECK (ads_billing_self_reported IS NULL OR jsonb_typeof(ads_billing_self_reported) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.client_intake.ads_platforms IS
  'Dónde va a publicitar el cliente: {google, meta}. {} = ninguno por ahora; NULL = no respondió.';
COMMENT ON COLUMN public.client_intake.ads_billing_self_reported IS
  '{google: timestamptz|null, meta: timestamptz|null}: cuándo el cliente marcó "Ya agregué mi tarjeta". Declarado, no verificado.';


-- =====================================================================
-- 2. Validación del paso Publicidad + submit_onboarding()
-- =====================================================================
-- Lanza 22023 con "campo ads_… inválido" (lo traduce mapDbError en la app).
CREATE OR REPLACE FUNCTION private.parse_onboarding_ads(
  _payload jsonb,
  OUT platforms text[],
  OUT reported jsonb)
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
DECLARE
  v jsonb;
  item jsonb;
  k text;
  p text;
BEGIN
  platforms := NULL;
  reported := NULL;
  v := _payload -> 'ads_platforms';
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN
    IF _payload ? 'ads_billing_self_reported' AND jsonb_typeof(_payload -> 'ads_billing_self_reported') <> 'null' THEN
      RAISE EXCEPTION 'campo ads_billing_self_reported inválido' USING ERRCODE = '22023';
    END IF;
    RETURN;
  END IF;
  IF jsonb_typeof(v) <> 'array' OR jsonb_array_length(v) > 2 THEN
    RAISE EXCEPTION 'campo ads_platforms inválido' USING ERRCODE = '22023';
  END IF;
  platforms := '{}';
  FOR item IN SELECT * FROM jsonb_array_elements(v) LOOP
    p := CASE WHEN jsonb_typeof(item) = 'string' THEN item #>> '{}' END;
    IF p IS NULL OR p NOT IN ('google', 'meta') OR p = ANY (platforms) THEN
      RAISE EXCEPTION 'campo ads_platforms inválido' USING ERRCODE = '22023';
    END IF;
    platforms := platforms || p;
  END LOOP;

  -- {google: bool, meta: bool} → {google: now()|null, meta: now()|null}
  v := _payload -> 'ads_billing_self_reported';
  IF v IS NOT NULL AND jsonb_typeof(v) <> 'null' THEN
    IF jsonb_typeof(v) <> 'object' THEN
      RAISE EXCEPTION 'campo ads_billing_self_reported inválido' USING ERRCODE = '22023';
    END IF;
    FOR k IN SELECT jsonb_object_keys(v) LOOP
      IF k NOT IN ('google', 'meta') OR jsonb_typeof(v -> k) <> 'boolean' THEN
        RAISE EXCEPTION 'campo ads_billing_self_reported inválido' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;
  IF cardinality(platforms) > 0 THEN
    reported := jsonb_build_object(
      'google', CASE WHEN 'google' = ANY (platforms) AND coalesce((v ->> 'google')::boolean, false)
                     THEN to_jsonb(now()) ELSE 'null'::jsonb END,
      'meta', CASE WHEN 'meta' = ANY (platforms) AND coalesce((v ->> 'meta')::boolean, false)
                   THEN to_jsonb(now()) ELSE 'null'::jsonb END);
  END IF;
END $$;

REVOKE ALL ON FUNCTION private.parse_onboarding_ads(jsonb) FROM PUBLIC, anon, authenticated;

-- Igual que 20261010000000_platform_v3.sql salvo lo marcado con "Publicidad".
CREATE OR REPLACE FUNCTION public.submit_onboarding(_token text, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  b public.client_billing%ROWTYPE;
  c_status text;
  r public.client_intake%ROWTYPE;
  ads record; -- Publicidad
BEGIN
  IF _token IS NULL OR _token !~ '^[0-9a-f]{48}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  -- FOR UPDATE: dos envíos simultáneos con el mismo link se serializan; el
  -- segundo ve el token ya expirado.
  SELECT * INTO b FROM public.client_billing
   WHERE onboarding_token = _token
     AND onboarding_token_expires_at IS NOT NULL
     AND onboarding_token_expires_at > now()
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT c.status INTO c_status FROM public.clients c WHERE c.id = b.client_id FOR UPDATE;
  IF c_status IS NULL OR c_status NOT IN ('prospecto', 'onboarding') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  BEGIN
    -- Publicidad: las claves ads_* se validan aparte; el resto, como siempre.
    IF _payload IS NOT NULL AND jsonb_typeof(_payload) = 'object' THEN
      r := private.parse_onboarding_payload(b.client_id, _payload - 'ads_platforms' - 'ads_billing_self_reported');
      SELECT * INTO ads FROM private.parse_onboarding_ads(_payload);
    ELSE
      r := private.parse_onboarding_payload(b.client_id, _payload);
    END IF;
  EXCEPTION WHEN invalid_parameter_value THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload', 'error', SQLERRM);
  END;

  INSERT INTO public.client_intake AS ci (
    client_id, razon_social, rut, giro, direccion, contacto_nombre, contacto_telefono,
    contacto_email, email_facturacion, descripcion, publico_objetivo, competencia,
    colores, estilo, links_redes, accesos_pendientes, archivos, submitted_at,
    ads_platforms, ads_billing_self_reported)
  VALUES (
    b.client_id, r.razon_social, r.rut, r.giro, r.direccion, r.contacto_nombre, r.contacto_telefono,
    r.contacto_email, r.email_facturacion, r.descripcion, r.publico_objetivo, r.competencia,
    r.colores, r.estilo, r.links_redes, r.accesos_pendientes, r.archivos, now(),
    ads.platforms, ads.reported)
  ON CONFLICT (client_id) DO UPDATE SET
    razon_social = EXCLUDED.razon_social,
    rut = EXCLUDED.rut,
    giro = EXCLUDED.giro,
    direccion = EXCLUDED.direccion,
    contacto_nombre = EXCLUDED.contacto_nombre,
    contacto_telefono = EXCLUDED.contacto_telefono,
    contacto_email = EXCLUDED.contacto_email,
    email_facturacion = EXCLUDED.email_facturacion,
    descripcion = EXCLUDED.descripcion,
    publico_objetivo = EXCLUDED.publico_objetivo,
    competencia = EXCLUDED.competencia,
    colores = EXCLUDED.colores,
    estilo = EXCLUDED.estilo,
    links_redes = EXCLUDED.links_redes,
    accesos_pendientes = EXCLUDED.accesos_pendientes,
    archivos = EXCLUDED.archivos,
    submitted_at = EXCLUDED.submitted_at,
    ads_platforms = EXCLUDED.ads_platforms,
    ads_billing_self_reported = EXCLUDED.ads_billing_self_reported;

  UPDATE public.onboarding_upload_reservations
     SET used = true
   WHERE client_id = b.client_id AND path = ANY (r.archivos) AND NOT used;

  -- Link de un solo uso: expira ahora (el token se conserva como registro).
  UPDATE public.client_billing
     SET onboarding_token_expires_at = now()
   WHERE client_id = b.client_id;

  UPDATE public.clients SET status = 'onboarding'
   WHERE id = b.client_id AND status = 'prospecto';

  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.submit_onboarding(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_onboarding(text, jsonb) TO anon, authenticated, service_role;


-- =====================================================================
-- 3. meta_billing_status: último chequeo de pago por cuenta publicitaria
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.meta_billing_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  -- Solo dígitos, sin el prefijo act_.
  ad_account_id text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  -- 1 ACTIVE, 2 DISABLED, 3 UNSETTLED, 7 PENDING_RISK_REVIEW,
  -- 8 PENDING_SETTLEMENT, 9 IN_GRACE_PERIOD, 100 PENDING_CLOSURE, 101 CLOSED
  account_status integer,
  disable_reason integer,
  -- NULL = Meta no entregó funding_source_details (sin permiso): no verificado.
  has_funding boolean,
  spend_cap numeric,
  amount_spent numeric,
  currency text,
  -- Motivo legible + error de la última consulta, si falló.
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_billing_status_account_uk UNIQUE (client_id, ad_account_id),
  CONSTRAINT meta_billing_status_account_chk CHECK (ad_account_id ~ '^[0-9]{1,30}$'),
  CONSTRAINT meta_billing_status_detail_chk CHECK (jsonb_typeof(detail) = 'object')
);

COMMENT ON TABLE public.meta_billing_status IS
  'Pago de pauta en Meta: último chequeo diario de cada cuenta publicitaria del cliente. Escribe solo service_role (cron y bloqueo al activar).';

REVOKE ALL ON public.meta_billing_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.meta_billing_status TO authenticated;
GRANT ALL ON public.meta_billing_status TO service_role;
ALTER TABLE public.meta_billing_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meta_billing_status select" ON public.meta_billing_status;
CREATE POLICY "meta_billing_status select" ON public.meta_billing_status FOR SELECT TO authenticated
  USING (public.owns_client(client_id));

DROP TRIGGER IF EXISTS t_meta_billing_status_u ON public.meta_billing_status;
CREATE TRIGGER t_meta_billing_status_u BEFORE UPDATE ON public.meta_billing_status
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- =====================================================================
-- 4. Chequeo diario (cron por lotes de 10, después de la ingesta de Meta)
--
--   meta_billing_check_0    06:50 UTC  cuentas 1–10
--   meta_billing_check_10   06:52 UTC  cuentas 11–20
--   meta_billing_check_20   06:54 UTC  cuentas 21–30  (&last=1)
--
-- Si el último lote deja cuentas sin revisar responde 500 "faltan lotes":
-- copia el último bloque con el offset nuevo y quita &last=1 del anterior.
-- =====================================================================
SELECT cron.schedule('meta_billing_check_0', '50 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_billing_check_0',
    'https://vibranding.pro/api/public/meta/billing-check?offset=0&limit=10');$cron$);

SELECT cron.schedule('meta_billing_check_10', '52 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_billing_check_10',
    'https://vibranding.pro/api/public/meta/billing-check?offset=10&limit=10');$cron$);

SELECT cron.schedule('meta_billing_check_20', '54 6 * * *',
  $cron$SELECT public.run_http_cron_job('meta_billing_check_20',
    'https://vibranding.pro/api/public/meta/billing-check?offset=20&limit=10&last=1');$cron$);
