-- =====================================================================
-- VIBRANDING · Plataforma v3 · migración única (NO APLICAR AÚN)
-- =====================================================================
-- Qué hace (resumen):
--   A. Onboarding público
--      1. client_intake: datos que el cliente entrega en el onboarding
--         (1 fila por cliente). Miembros de la org leen; nadie escribe
--         desde el navegador (solo submit_onboarding() y service_role).
--      2. submit_onboarding(token, payload): SECURITY DEFINER, ejecutable por
--         anon. Valida token vigente (client_billing.onboarding_token +
--         onboarding_token_expires_at), valida forma y tamaño del payload,
--         guarda, expira el token (un solo envío por link) y pasa el cliente
--         de 'prospecto' a 'onboarding'.
--      3. Bucket privado 'onboarding' (ver "Subida de archivos" abajo).
--   B. Endurecimiento de cobros (SQL propuesto en PR #14)
--      4. payment_provider_orders: historial de órdenes de Flow por cobro.
--      5. payment_anomalies: anomalías de cobro (duplicado, mismatch, ...).
--      6. Trigger: no se cambia amount/currency de un cobro pending/overdue
--         con flow_token (link de Flow) desde el navegador.
--      7. payments: desde el navegador ya no se escriben status, paid_at,
--         provider, provider_ref, flow_token, payment_url ni subscription_id
--         (ni en UPDATE ni en INSERT). El cambio de estado manual pasa por
--         set_payment_status() (SECURITY DEFINER, can_edit_client, con
--         transiciones válidas). La app (PaymentsPanel, /billing) se adapta
--         en el mismo PR.
--
-- Subida de archivos del onboarding (no se puede expresar 100% en SQL):
--   - El bucket 'onboarding' es privado y NO tiene policies de INSERT/UPDATE/
--     DELETE para anon ni authenticated: nadie sube directo desde el navegador.
--   - La subida se hace SOLO con URL firmada: una server fn (con
--     supabaseAdmin) recibe { token, filename, contentType, size }, valida el
--     token igual que get_onboarding_by_token (48 hex, vigente, cliente en
--     prospecto/onboarding), valida tipo/tamaño, y llama
--       supabaseAdmin.storage.from('onboarding')
--         .createSignedUploadUrl(`${client_id}/${crypto.randomUUID()}-${safeName}`)
--     El navegador sube con uploadToSignedUrl(path, token, file) y luego
--     envía esos paths en payload.archivos de submit_onboarding(), que
--     verifica que cada path empiece por "<client_id>/" y exista en el bucket.
--   - Lectura: miembros de la org del cliente (owns_client) pueden leer
--     objetos "<client_id>/..." (createSignedUrl desde la app).
--   - Límite del bucket: 10 MB y tipos PDF/PNG/JPEG/WEBP/ZIP (sin SVG: puede
--     llevar scripts). Archivos subidos y nunca enviados quedan huérfanos;
--     limpiarlos con un job de servidor si llega a importar.
--
-- Cómo se aplica: UNA sola vez, FUERA DE HORARIO, después de
-- 20261005000000_platform_v2.sql, vía Lovable ("aplica la migración
-- supabase/migrations/20261010000000_platform_v3.sql tal cual") o pegándola
-- completa en el SQL editor de Supabase (una sola transacción).
-- Es idempotente: re-ejecutarla no rompe nada.
--
-- IMPORTANTE: aplicar SOLO junto con el deploy del código de este PR
-- (PaymentsPanel y /billing usan set_payment_status). Con el código anterior,
-- "Marcar pagado" y el selector de estado fallan con "permission denied".
-- =====================================================================

-- Si alguna tabla está bloqueada, fallar rápido en vez de colgar la app.
SET LOCAL lock_timeout = '5s';


-- =====================================================================
-- 0. Esquema privado para helpers (no expuesto por la API REST)
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

-- RUT chileno: formato 12.345.678-9 / 12345678-9 / 123456789 + dígito verificador (módulo 11).
CREATE OR REPLACE FUNCTION private.rut_is_valid(_rut text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
  clean text;
  body text;
  dv text;
  s integer := 0;
  m integer := 2;
  i integer;
  r integer;
  expected text;
BEGIN
  IF _rut IS NULL OR _rut !~ '^[0-9]{1,2}(\.?[0-9]{3}){2}-?[0-9kK]$' THEN
    RETURN false;
  END IF;
  clean := upper(replace(replace(_rut, '.', ''), '-', ''));
  body := left(clean, length(clean) - 1);
  dv := right(clean, 1);
  FOR i IN REVERSE length(body)..1 LOOP
    s := s + substr(body, i, 1)::integer * m;
    m := CASE WHEN m = 7 THEN 2 ELSE m + 1 END;
  END LOOP;
  r := 11 - (s % 11);
  expected := CASE r WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE r::text END;
  RETURN dv = expected;
END $$;

-- Texto opcional del payload: NULL si no viene o viene vacío; error si no es
-- string o supera el largo.
CREATE OR REPLACE FUNCTION private.intake_text(_payload jsonb, _key text, _max integer)
RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE v jsonb := _payload -> _key; t text;
BEGIN
  IF v IS NULL OR jsonb_typeof(v) = 'null' THEN RETURN NULL; END IF;
  IF jsonb_typeof(v) <> 'string' THEN
    RAISE EXCEPTION 'campo % debe ser texto', _key USING ERRCODE = '22023';
  END IF;
  t := btrim(v #>> '{}');
  IF length(t) > _max THEN
    RAISE EXCEPTION 'campo % supera % caracteres', _key, _max USING ERRCODE = '22023';
  END IF;
  RETURN nullif(t, '');
END $$;

-- Heurística: el onboarding nunca debe recibir contraseñas (solo checklist).
CREATE OR REPLACE FUNCTION private.looks_like_secret(_t text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT coalesce(_t ~* '(contrase(ñ|n)a|password|passwd|clave|pin)\s*[:=]', false)
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;


-- =====================================================================
-- A1. client_intake
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.client_intake (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  razon_social text NOT NULL,
  rut text,
  giro text,
  direccion text,
  contacto_nombre text,
  contacto_telefono text,
  contacto_email text,
  email_facturacion text,
  descripcion text,
  publico_objetivo text,
  competencia text,
  colores text[] NOT NULL DEFAULT '{}',
  estilo text,
  links_redes jsonb NOT NULL DEFAULT '{}'::jsonb,
  accesos_pendientes jsonb NOT NULL DEFAULT '[]'::jsonb,
  archivos text[] NOT NULL DEFAULT '{}',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_intake_razon_social_chk CHECK (btrim(razon_social) <> '' AND length(razon_social) <= 200),
  CONSTRAINT client_intake_links_chk CHECK (jsonb_typeof(links_redes) = 'object'),
  CONSTRAINT client_intake_accesos_chk CHECK (jsonb_typeof(accesos_pendientes) = 'array'),
  CONSTRAINT client_intake_colores_chk CHECK (cardinality(colores) <= 12),
  CONSTRAINT client_intake_archivos_chk CHECK (cardinality(archivos) <= 20)
);

COMMENT ON TABLE public.client_intake IS
  'Datos del onboarding público (1:1 con clients). Escribe solo submit_onboarding() / service_role; leen miembros de la org.';
COMMENT ON COLUMN public.client_intake.accesos_pendientes IS
  'Checklist [{servicio, estado: pendiente|compartido|no_aplica, nota}]. NUNCA contraseñas.';
COMMENT ON COLUMN public.client_intake.archivos IS
  'Paths en el bucket privado "onboarding" (siempre "<client_id>/...").';

REVOKE ALL ON public.client_intake FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.client_intake TO authenticated;
GRANT ALL ON public.client_intake TO service_role;
ALTER TABLE public.client_intake ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_intake select" ON public.client_intake;
CREATE POLICY "client_intake select" ON public.client_intake FOR SELECT TO authenticated
  USING (public.owns_client(client_id));

DROP TRIGGER IF EXISTS t_client_intake_u ON public.client_intake;
CREATE TRIGGER t_client_intake_u BEFORE UPDATE ON public.client_intake
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- =====================================================================
-- A2. Validación del payload + submit_onboarding()
-- =====================================================================
-- Devuelve la fila a guardar o lanza 22023 (invalid_parameter_value) con el
-- campo inválido. Cada path de archivos debe existir en storage.objects.
CREATE OR REPLACE FUNCTION private.parse_onboarding_payload(_client_id uuid, _payload jsonb)
RETURNS public.client_intake
LANGUAGE plpgsql STABLE SET search_path = ''
AS $$
DECLARE
  r public.client_intake%ROWTYPE;
  k text;
  v jsonb;
  item jsonb;
  t text;
  allowed_keys constant text[] := ARRAY[
    'razon_social', 'rut', 'giro', 'direccion', 'contacto_nombre', 'contacto_telefono',
    'contacto_email', 'email_facturacion', 'descripcion', 'publico_objetivo', 'competencia',
    'colores', 'estilo', 'links_redes', 'accesos_pendientes', 'archivos'];
  link_keys constant text[] := ARRAY['instagram', 'facebook', 'tiktok', 'linkedin', 'youtube', 'x', 'web', 'otro'];
  email_re constant text := '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
  path_prefix text := _client_id::text || '/';
BEGIN
  IF _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload debe ser un objeto' USING ERRCODE = '22023';
  END IF;
  IF octet_length(_payload::text) > 65536 THEN
    RAISE EXCEPTION 'payload supera 64 KB' USING ERRCODE = '22023';
  END IF;
  FOR k IN SELECT jsonb_object_keys(_payload) LOOP
    IF NOT k = ANY (allowed_keys) THEN
      RAISE EXCEPTION 'campo % no permitido', k USING ERRCODE = '22023';
    END IF;
  END LOOP;

  r.client_id := _client_id;
  r.razon_social := private.intake_text(_payload, 'razon_social', 200);
  IF r.razon_social IS NULL THEN
    RAISE EXCEPTION 'campo razon_social es obligatorio' USING ERRCODE = '22023';
  END IF;

  r.rut := private.intake_text(_payload, 'rut', 12);
  IF r.rut IS NOT NULL AND NOT private.rut_is_valid(r.rut) THEN
    RAISE EXCEPTION 'campo rut inválido' USING ERRCODE = '22023';
  END IF;

  r.giro := private.intake_text(_payload, 'giro', 200);
  r.direccion := private.intake_text(_payload, 'direccion', 300);
  r.contacto_nombre := private.intake_text(_payload, 'contacto_nombre', 120);

  r.contacto_telefono := private.intake_text(_payload, 'contacto_telefono', 30);
  IF r.contacto_telefono IS NOT NULL AND r.contacto_telefono !~ '^\+?[0-9 ()-]{6,30}$' THEN
    RAISE EXCEPTION 'campo contacto_telefono inválido' USING ERRCODE = '22023';
  END IF;

  r.contacto_email := lower(private.intake_text(_payload, 'contacto_email', 254));
  IF r.contacto_email IS NOT NULL AND r.contacto_email !~ email_re THEN
    RAISE EXCEPTION 'campo contacto_email inválido' USING ERRCODE = '22023';
  END IF;
  r.email_facturacion := lower(private.intake_text(_payload, 'email_facturacion', 254));
  IF r.email_facturacion IS NOT NULL AND r.email_facturacion !~ email_re THEN
    RAISE EXCEPTION 'campo email_facturacion inválido' USING ERRCODE = '22023';
  END IF;

  r.descripcion := private.intake_text(_payload, 'descripcion', 4000);
  r.publico_objetivo := private.intake_text(_payload, 'publico_objetivo', 2000);
  r.competencia := private.intake_text(_payload, 'competencia', 2000);
  r.estilo := private.intake_text(_payload, 'estilo', 2000);

  -- colores: array de hasta 12 textos cortos (#hex o nombre)
  r.colores := '{}';
  v := _payload -> 'colores';
  IF v IS NOT NULL AND jsonb_typeof(v) <> 'null' THEN
    IF jsonb_typeof(v) <> 'array' OR jsonb_array_length(v) > 12 THEN
      RAISE EXCEPTION 'campo colores debe ser una lista de hasta 12' USING ERRCODE = '22023';
    END IF;
    FOR item IN SELECT * FROM jsonb_array_elements(v) LOOP
      IF jsonb_typeof(item) <> 'string' OR length(item #>> '{}') > 40 OR btrim(item #>> '{}') = '' THEN
        RAISE EXCEPTION 'campo colores: cada color es un texto de hasta 40 caracteres' USING ERRCODE = '22023';
      END IF;
      r.colores := r.colores || btrim(item #>> '{}');
    END LOOP;
  END IF;

  -- links_redes: objeto {red: url/usuario}
  r.links_redes := '{}'::jsonb;
  v := _payload -> 'links_redes';
  IF v IS NOT NULL AND jsonb_typeof(v) <> 'null' THEN
    IF jsonb_typeof(v) <> 'object' THEN
      RAISE EXCEPTION 'campo links_redes debe ser un objeto' USING ERRCODE = '22023';
    END IF;
    FOR k IN SELECT jsonb_object_keys(v) LOOP
      IF NOT k = ANY (link_keys) THEN
        RAISE EXCEPTION 'links_redes: red % no permitida', k USING ERRCODE = '22023';
      END IF;
      t := private.intake_text(v, k, 300);
      IF t IS NOT NULL THEN
        IF t !~* '^(https?://|@)?[^\s<>"]+$' THEN
          RAISE EXCEPTION 'links_redes.% inválido', k USING ERRCODE = '22023';
        END IF;
        r.links_redes := r.links_redes || jsonb_build_object(k, t);
      END IF;
    END LOOP;
  END IF;

  -- accesos_pendientes: checklist, sin contraseñas
  r.accesos_pendientes := '[]'::jsonb;
  v := _payload -> 'accesos_pendientes';
  IF v IS NOT NULL AND jsonb_typeof(v) <> 'null' THEN
    IF jsonb_typeof(v) <> 'array' OR jsonb_array_length(v) > 30 THEN
      RAISE EXCEPTION 'campo accesos_pendientes debe ser una lista de hasta 30' USING ERRCODE = '22023';
    END IF;
    FOR item IN SELECT * FROM jsonb_array_elements(v) LOOP
      IF jsonb_typeof(item) <> 'object' THEN
        RAISE EXCEPTION 'accesos_pendientes: cada ítem es un objeto' USING ERRCODE = '22023';
      END IF;
      FOR k IN SELECT jsonb_object_keys(item) LOOP
        IF NOT k = ANY (ARRAY['servicio', 'estado', 'nota']) THEN
          RAISE EXCEPTION 'accesos_pendientes: campo % no permitido (no se aceptan contraseñas)', k USING ERRCODE = '22023';
        END IF;
      END LOOP;
      t := private.intake_text(item, 'servicio', 80);
      IF t IS NULL THEN
        RAISE EXCEPTION 'accesos_pendientes: servicio es obligatorio' USING ERRCODE = '22023';
      END IF;
      IF coalesce(private.intake_text(item, 'estado', 20), 'pendiente') NOT IN ('pendiente', 'compartido', 'no_aplica') THEN
        RAISE EXCEPTION 'accesos_pendientes: estado inválido' USING ERRCODE = '22023';
      END IF;
      IF private.looks_like_secret(private.intake_text(item, 'nota', 300))
         OR private.looks_like_secret(t) THEN
        RAISE EXCEPTION 'accesos_pendientes: no envíes contraseñas, solo indica el estado del acceso' USING ERRCODE = '22023';
      END IF;
      r.accesos_pendientes := r.accesos_pendientes || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'servicio', t,
        'estado', coalesce(private.intake_text(item, 'estado', 20), 'pendiente'),
        'nota', private.intake_text(item, 'nota', 300))));
    END LOOP;
  END IF;

  -- archivos: paths del bucket 'onboarding' bajo "<client_id>/", que existan
  r.archivos := '{}';
  v := _payload -> 'archivos';
  IF v IS NOT NULL AND jsonb_typeof(v) <> 'null' THEN
    IF jsonb_typeof(v) <> 'array' OR jsonb_array_length(v) > 20 THEN
      RAISE EXCEPTION 'campo archivos debe ser una lista de hasta 20' USING ERRCODE = '22023';
    END IF;
    FOR item IN SELECT * FROM jsonb_array_elements(v) LOOP
      t := CASE WHEN jsonb_typeof(item) = 'string' THEN item #>> '{}' END;
      IF t IS NULL OR length(t) > 300 OR left(t, length(path_prefix)) <> path_prefix
         OR substr(t, length(path_prefix) + 1) !~ '^[A-Za-z0-9][A-Za-z0-9._ -]{0,250}$'
         OR position('..' IN t) > 0 THEN
        RAISE EXCEPTION 'archivos: path inválido' USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'onboarding' AND o.name = t) THEN
        RAISE EXCEPTION 'archivos: % no existe en el bucket', t USING ERRCODE = '22023';
      END IF;
      IF NOT t = ANY (r.archivos) THEN
        r.archivos := r.archivos || t;
      END IF;
    END LOOP;
  END IF;

  RETURN r;
END $$;

REVOKE ALL ON FUNCTION private.parse_onboarding_payload(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- Pública (anon): un envío por link. Respuestas:
--   {ok:true}                                  guardado
--   {ok:false, reason:'invalid'}               token mal formado / desconocido / vencido / ya usado
--   {ok:false, reason:'invalid_payload', error} payload rechazado (mensaje apto para mostrar)
CREATE OR REPLACE FUNCTION public.submit_onboarding(_token text, _payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  b public.client_billing%ROWTYPE;
  c_status text;
  r public.client_intake%ROWTYPE;
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
    r := private.parse_onboarding_payload(b.client_id, _payload);
  EXCEPTION WHEN invalid_parameter_value THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_payload', 'error', SQLERRM);
  END;

  INSERT INTO public.client_intake AS ci (
    client_id, razon_social, rut, giro, direccion, contacto_nombre, contacto_telefono,
    contacto_email, email_facturacion, descripcion, publico_objetivo, competencia,
    colores, estilo, links_redes, accesos_pendientes, archivos, submitted_at)
  VALUES (
    b.client_id, r.razon_social, r.rut, r.giro, r.direccion, r.contacto_nombre, r.contacto_telefono,
    r.contacto_email, r.email_facturacion, r.descripcion, r.publico_objetivo, r.competencia,
    r.colores, r.estilo, r.links_redes, r.accesos_pendientes, r.archivos, now())
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
    submitted_at = EXCLUDED.submitted_at;

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
-- A3. Bucket privado 'onboarding' (subida solo con URL firmada)
-- =====================================================================
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE NOTICE 'platform_v3: storage.buckets no existe; crear el bucket "onboarding" (privado) a mano';
    RETURN;
  END IF;

  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('onboarding', 'onboarding', false, 10485760,
          ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/zip'])
  ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

  -- Solo lectura para miembros de la org del cliente ("<client_id>/archivo").
  -- Sin policies de INSERT/UPDATE/DELETE: la subida usa createSignedUploadUrl
  -- (service role) y no pasa por RLS de anon/authenticated.
  DROP POLICY IF EXISTS "onboarding members read" ON storage.objects;
  CREATE POLICY "onboarding members read" ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'onboarding'
      AND public.owns_client(
        CASE WHEN split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN split_part(name, '/', 1)::uuid END)
    );
END $$;


-- =====================================================================
-- B4. payment_provider_orders (historial de órdenes de Flow)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.payment_provider_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  provider text NOT NULL,
  commerce_order text NOT NULL,
  token text NOT NULL,
  flow_order text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'CLP',
  payment_url text,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'pendiente',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_provider_orders_provider_chk CHECK (provider IN ('flow')),
  CONSTRAINT payment_provider_orders_amount_chk CHECK (amount >= 0),
  CONSTRAINT payment_provider_orders_status_chk CHECK (status IN ('pendiente', 'pagada', 'rechazada', 'anulada', 'expirada')),
  CONSTRAINT payment_provider_orders_token_uk UNIQUE (provider, token),
  CONSTRAINT payment_provider_orders_commerce_uk UNIQUE (provider, commerce_order)
);

CREATE INDEX IF NOT EXISTS payment_provider_orders_payment_idx ON public.payment_provider_orders (payment_id);

-- Solo service_role (sin policies).
REVOKE ALL ON public.payment_provider_orders FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_provider_orders TO service_role;
ALTER TABLE public.payment_provider_orders ENABLE ROW LEVEL SECURITY;


-- =====================================================================
-- B5. payment_anomalies (reemplaza la nota en payments.description)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.payment_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  kind text NOT NULL,
  provider text NOT NULL DEFAULT 'flow',
  flow_order text,
  commerce_order text,
  amount numeric,
  currency text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_anomalies_kind_chk CHECK (kind IN ('duplicate', 'mismatch', 'unknown_order', 'cancelled_paid')),
  CONSTRAINT payment_anomalies_detail_chk CHECK (jsonb_typeof(detail) = 'object'),
  -- NULLS NOT DISTINCT: sin flow_order también se deduplica (PG15+).
  CONSTRAINT payment_anomalies_uk UNIQUE NULLS NOT DISTINCT (payment_id, kind, flow_order)
);

CREATE INDEX IF NOT EXISTS payment_anomalies_open_idx
  ON public.payment_anomalies (created_at DESC) WHERE resolved_at IS NULL;

-- Escribe solo el servidor; los editores del cliente pueden leer.
REVOKE ALL ON public.payment_anomalies FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payment_anomalies TO authenticated;
GRANT ALL ON public.payment_anomalies TO service_role;
ALTER TABLE public.payment_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_anomalies select" ON public.payment_anomalies;
CREATE POLICY "payment_anomalies select" ON public.payment_anomalies FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = payment_anomalies.payment_id AND public.can_edit_client(p.client_id)
  ));


-- =====================================================================
-- B6. No cambiar monto/moneda con un link de Flow vigente
-- =====================================================================
-- Vigente = flow_token presente y cobro pending/overdue. Aplica a anon y
-- authenticated (navegador); el servidor (service_role) y las funciones
-- SECURITY DEFINER no se bloquean.
CREATE OR REPLACE FUNCTION public.lock_amount_with_flow_order()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND OLD.flow_token IS NOT NULL
     AND OLD.status IN ('pending', 'overdue')
     AND (NEW.amount IS DISTINCT FROM OLD.amount OR NEW.currency IS DISTINCT FROM OLD.currency) THEN
    RAISE EXCEPTION 'No se puede cambiar el monto de un cobro con link de pago vigente'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.lock_amount_with_flow_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_payments_lock_amount ON public.payments;
CREATE TRIGGER t_payments_lock_amount BEFORE UPDATE OF amount, currency ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.lock_amount_with_flow_order();


-- =====================================================================
-- B7. payments: columnas de cobro/proveedor solo para el servidor
-- =====================================================================
-- Desde el navegador (authenticated) solo se escriben los datos del cobro.
-- status / paid_at / provider: vía set_payment_status().
-- flow_token / payment_url / provider_ref / subscription_id: solo servidor.
-- client_id no es editable (un cobro no se mueve de cliente).
-- NOTA: una columna nueva en payments debe agregarse aquí si el navegador
-- necesita escribirla.
REVOKE INSERT, UPDATE ON public.payments FROM anon, authenticated;
GRANT INSERT (client_id, description, amount, currency, due_date, document_type, kind, period)
  ON public.payments TO authenticated;
GRANT UPDATE (description, amount, currency, due_date, document_type, kind, period)
  ON public.payments TO authenticated;

-- Cambio de estado manual. Transiciones válidas:
--   pending   -> paid | overdue | cancelled
--   overdue   -> paid | pending | cancelled
--   cancelled -> pending
--   paid      -> pending      (deshacer un "marcar pagado" manual)
--   paid      -> paid         (corregir paid_at de un pago manual)
-- Un pago confirmado por Flow (provider='flow' con provider_ref) no se
-- revierte ni se edita desde aquí.
CREATE OR REPLACE FUNCTION public.set_payment_status(
  _payment_id uuid,
  _status public.payment_status,
  _paid_at date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  p public.payments%ROWTYPE;
  cid uuid;
  today date := (now() AT TIME ZONE 'America/Santiago')::date;
  flow_confirmed boolean;
  allowed boolean;
BEGIN
  IF _payment_id IS NULL OR _status IS NULL THEN
    RAISE EXCEPTION 'payment_id y status son obligatorios' USING ERRCODE = '22023';
  END IF;

  SELECT client_id INTO cid FROM public.payments WHERE id = _payment_id;
  IF cid IS NULL OR NOT public.can_edit_client(cid) THEN
    RAISE EXCEPTION 'No tienes permisos para esta acción' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO p FROM public.payments WHERE id = _payment_id FOR UPDATE;

  IF _paid_at IS NOT NULL AND (_paid_at > today OR _paid_at < DATE '2000-01-01') THEN
    RAISE EXCEPTION 'Fecha de pago inválida' USING ERRCODE = '22023';
  END IF;

  flow_confirmed := p.status = 'paid' AND p.provider = 'flow' AND p.provider_ref IS NOT NULL;

  allowed := CASE p.status
    WHEN 'pending'   THEN _status IN ('pending', 'paid', 'overdue', 'cancelled')
    WHEN 'overdue'   THEN _status IN ('overdue', 'paid', 'pending', 'cancelled')
    WHEN 'cancelled' THEN _status IN ('cancelled', 'pending')
    WHEN 'paid'      THEN _status IN ('paid', 'pending') AND NOT flow_confirmed
    ELSE false
  END;
  IF NOT allowed THEN
    RAISE EXCEPTION 'Cambio de estado no permitido: % -> %', p.status, _status USING ERRCODE = '22023';
  END IF;

  IF _status = 'paid' THEN
    UPDATE public.payments
       SET status = 'paid',
           paid_at = coalesce(_paid_at, CASE WHEN p.status = 'paid' THEN p.paid_at END, today),
           provider = 'manual'
     WHERE id = p.id
     RETURNING * INTO p;
  ELSIF p.status = 'paid' THEN
    -- Deshacer pago manual: vuelve al proveedor del link, si lo hay.
    UPDATE public.payments
       SET status = _status,
           paid_at = NULL,
           provider = CASE WHEN flow_token IS NOT NULL THEN 'flow' END
     WHERE id = p.id
     RETURNING * INTO p;
  ELSIF _status IS DISTINCT FROM p.status THEN
    UPDATE public.payments
       SET status = _status, paid_at = NULL
     WHERE id = p.id
     RETURNING * INTO p;
  END IF;

  RETURN jsonb_build_object('id', p.id, 'status', p.status, 'paid_at', p.paid_at, 'provider', p.provider);
END $$;

REVOKE ALL ON FUNCTION public.set_payment_status(uuid, public.payment_status, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_payment_status(uuid, public.payment_status, date) TO authenticated, service_role;


-- =====================================================================
-- C8. prospects: vínculo con cliente, "no contactar" y deduplicación
-- =====================================================================
ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS no_contactar_hasta date,
  ADD COLUMN IF NOT EXISTS baja_revocada_at timestamptz;

COMMENT ON COLUMN public.prospects.client_id IS 'Cliente creado al convertir el prospecto (convert_prospect_to_client).';
COMMENT ON COLUMN public.prospects.no_contactar_hasta IS 'No contactar antes de esta fecha (pidió esperar).';
COMMENT ON COLUMN public.prospects.baja_revocada_at IS
  'Marca explícita para sacar un prospecto de ''baja'': el UPDATE que cambia estado debe ponerla en now().';

CREATE INDEX IF NOT EXISTS prospects_client_idx ON public.prospects (client_id) WHERE client_id IS NOT NULL;

-- client_id debe ser un cliente de la misma org (reutiliza enforce_client_in_org de v2).
DROP TRIGGER IF EXISTS t_prospects_client_org ON public.prospects;
CREATE TRIGGER t_prospects_client_org BEFORE INSERT OR UPDATE OF client_id, org_id ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.enforce_client_in_org();

-- Clave de deduplicación nombre+comuna: minúsculas, sin espacios extra y,
-- si la extensión unaccent YA está instalada, sin tildes. La función se fija
-- al aplicar la migración. Si después se instala unaccent y se quiere usar:
-- re-ejecutar esta migración (recrea la función) y luego
-- REINDEX INDEX public.prospects_org_nombre_comuna_uk;
DO $$
DECLARE ext_schema text;
BEGIN
  SELECT n.nspname INTO ext_schema
  FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'unaccent';

  IF ext_schema IS NOT NULL THEN
    EXECUTE format($f$
      CREATE OR REPLACE FUNCTION public.prospect_name_key(_nombre text, _comuna text)
      RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = ''
      AS $b$
        SELECT lower(%1$I.unaccent('%1$I.unaccent'::regdictionary,
                 regexp_replace(btrim(coalesce(_nombre, '')), '\s+', ' ', 'g')))
               || '|' ||
               lower(%1$I.unaccent('%1$I.unaccent'::regdictionary,
                 regexp_replace(btrim(coalesce(_comuna, '')), '\s+', ' ', 'g')))
      $b$;
    $f$, ext_schema);
  ELSE
    RAISE NOTICE 'platform_v3: unaccent no está instalado; la clave nombre+comuna usa lower(trim()) (sin quitar tildes)';
    CREATE OR REPLACE FUNCTION public.prospect_name_key(_nombre text, _comuna text)
    RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = ''
    AS $b$
      SELECT lower(regexp_replace(btrim(coalesce(_nombre, '')), '\s+', ' ', 'g'))
             || '|' ||
             lower(regexp_replace(btrim(coalesce(_comuna, '')), '\s+', ' ', 'g'))
    $b$;
  END IF;
END $$;
-- Va en public (no en private) y con EXECUTE para authenticated/service_role:
-- la expresión del índice se evalúa con los permisos de quien inserta o
-- actualiza el prospecto. Es una función pura, no expone datos.
REVOKE ALL ON FUNCTION public.prospect_name_key(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prospect_name_key(text, text) TO authenticated, service_role;

-- Índices únicos: si ya hay duplicados, WARNING y no se crea (no falla la migración).
DO $$
DECLARE
  dup record;
  has_dups boolean;
BEGIN
  has_dups := false;
  FOR dup IN
    SELECT org_id, lower(btrim(email_publico)) AS email, array_agg(id ORDER BY created_at) AS ids
    FROM public.prospects
    WHERE email_publico IS NOT NULL AND btrim(email_publico) <> ''
    GROUP BY org_id, lower(btrim(email_publico))
    HAVING count(*) > 1
  LOOP
    has_dups := true;
    RAISE WARNING 'platform_v3: email_publico % repetido en la org %: %', dup.email, dup.org_id, dup.ids;
  END LOOP;
  IF has_dups THEN
    RAISE WARNING 'platform_v3: índice prospects_org_email_uk NO creado. Unifica los duplicados y re-ejecuta la migración.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS prospects_org_email_uk
      ON public.prospects (org_id, lower(btrim(email_publico)))
      WHERE email_publico IS NOT NULL AND btrim(email_publico) <> '';
  END IF;

  has_dups := false;
  FOR dup IN
    SELECT org_id, public.prospect_name_key(nombre, comuna) AS k, array_agg(id ORDER BY created_at) AS ids
    FROM public.prospects
    GROUP BY org_id, public.prospect_name_key(nombre, comuna)
    HAVING count(*) > 1
  LOOP
    has_dups := true;
    RAISE WARNING 'platform_v3: prospecto % repetido en la org %: %', dup.k, dup.org_id, dup.ids;
  END LOOP;
  IF has_dups THEN
    RAISE WARNING 'platform_v3: índice prospects_org_nombre_comuna_uk NO creado. Unifica los duplicados y re-ejecuta la migración.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS prospects_org_nombre_comuna_uk
      ON public.prospects (org_id, public.prospect_name_key(nombre, comuna));
  END IF;
END $$;


-- =====================================================================
-- C9. 'baja' es pegajosa (pidió no ser contactado)
-- =====================================================================
-- Para sacar un prospecto de 'baja' (p. ej. volvió a escribir pidiendo
-- contacto), el MISMO UPDATE debe cambiar estado y poner
-- baja_revocada_at = now() (se acepta hasta 5 minutos de antigüedad, para
-- relojes del servidor algo desfasados; nunca en el futuro > 1 min).
--   UPDATE prospects SET estado = 'contactado', baja_revocada_at = now() WHERE id = ...;
-- Al volver a 'baja' se limpia baja_revocada_at, así cada revocación exige
-- una marca nueva. Aplica a todos los roles (también service_role).
CREATE OR REPLACE FUNCTION public.guard_prospect_baja()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.estado = 'baja' THEN
    IF TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'baja' THEN
      NEW.baja_revocada_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.estado = 'baja' THEN
    IF NEW.baja_revocada_at IS NULL
       OR NEW.baja_revocada_at IS NOT DISTINCT FROM OLD.baja_revocada_at
       OR NEW.baja_revocada_at < now() - interval '5 minutes'
       OR NEW.baja_revocada_at > now() + interval '1 minute' THEN
      RAISE EXCEPTION 'El prospecto pidió la baja: para cambiar su estado marca baja_revocada_at = now() en el mismo cambio'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_prospect_baja() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_prospects_baja_guard ON public.prospects;
CREATE TRIGGER t_prospects_baja_guard BEFORE INSERT OR UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.guard_prospect_baja();


-- =====================================================================
-- C10. convert_prospect_to_client()
-- =====================================================================
-- Editores de la org (can_edit_org). Transaccional (una función = una
-- transacción) e idempotente: si el prospecto ya tiene client_id, lo
-- devuelve sin crear nada. Rechaza prospectos en 'baja'.
-- Crea clients (status 'onboarding', started_at = hoy en Chile) +
-- client_billing (plan_key, mrr = _mrr_clp) y marca el prospecto 'ganado'.
-- Respuesta: {client_id, created}.
-- Nota: requiere sesión de usuario (auth.uid()); el servidor con service
-- role no pasa can_edit_org.
CREATE OR REPLACE FUNCTION public.convert_prospect_to_client(
  _prospect_id uuid,
  _plan_key text,
  _mrr_clp integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  pr public.prospects%ROWTYPE;
  oid_ uuid;
  new_client uuid;
  creator uuid;
BEGIN
  IF _prospect_id IS NULL THEN
    RAISE EXCEPTION 'prospect_id es obligatorio' USING ERRCODE = '22023';
  END IF;

  SELECT org_id INTO oid_ FROM public.prospects WHERE id = _prospect_id;
  IF oid_ IS NULL OR NOT public.can_edit_org(oid_) THEN
    RAISE EXCEPTION 'No tienes permisos para esta acción' USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE: dos clics simultáneos se serializan; el segundo ve client_id.
  SELECT * INTO pr FROM public.prospects WHERE id = _prospect_id FOR UPDATE;

  IF pr.client_id IS NOT NULL THEN
    RETURN jsonb_build_object('client_id', pr.client_id, 'created', false);
  END IF;
  IF pr.estado = 'baja' THEN
    RAISE EXCEPTION 'El prospecto pidió la baja: no se puede convertir en cliente' USING ERRCODE = '22023';
  END IF;
  IF _plan_key IS NOT NULL AND _plan_key NOT IN ('marca-web', 'contenido', 'crecimiento') THEN
    RAISE EXCEPTION 'plan_key inválido' USING ERRCODE = '22023';
  END IF;
  IF _mrr_clp IS NULL OR _mrr_clp < 0 OR _mrr_clp > 100000000 THEN
    RAISE EXCEPTION 'mrr_clp debe estar entre 0 y 100.000.000' USING ERRCODE = '22023';
  END IF;

  -- clients.user_id (legado) es NOT NULL: el usuario que convierte.
  creator := auth.uid();

  INSERT INTO public.clients (user_id, org_id, name, instagram_handle, status, started_at)
  VALUES (creator, pr.org_id, pr.nombre, nullif(btrim(coalesce(pr.instagram, '')), ''), 'onboarding',
          (now() AT TIME ZONE 'America/Santiago')::date)
  RETURNING id INTO new_client;

  -- La fila de client_billing la crea t_client_billing_create; upsert por si acaso.
  INSERT INTO public.client_billing (client_id, plan_key, mrr)
  VALUES (new_client, _plan_key, _mrr_clp)
  ON CONFLICT (client_id) DO UPDATE SET plan_key = EXCLUDED.plan_key, mrr = EXCLUDED.mrr;

  UPDATE public.prospects
     SET estado = 'ganado', client_id = new_client
   WHERE id = pr.id;

  RETURN jsonb_build_object('client_id', new_client, 'created', true);
END $$;

REVOKE ALL ON FUNCTION public.convert_prospect_to_client(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_prospect_to_client(uuid, text, integer) TO authenticated, service_role;
