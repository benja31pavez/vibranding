-- =====================================================================
-- VIBRANDING · Plataforma v3 · parte aditiva (NO APLICAR AÚN)
-- =====================================================================
-- Qué hace (resumen):
--   A. Onboarding público
--      1. client_intake: datos que el cliente entrega en el onboarding
--         (1 fila por cliente). Editores (can_edit_client) leen; nadie escribe
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
--      6. Trigger: desde el navegador no se cambia amount/currency de un
--         cobro pagado o con flow_token (link de Flow).
--      7. set_payment_status() (SECURITY DEFINER, manages_client = owner/admin,
--         transiciones válidas): el cambio de estado manual. La app
--         (PaymentsPanel, /billing) ya la usa en este PR.
--         El cierre de columnas (REVOKE/GRANT por columna en payments) va
--         aparte en 20261010000100_platform_v3b_payments_lockdown.sql.
--   C. Prospectos
--      8. prospects: estado 'frio' (CHECK con nombre), client_id (FK, misma org), no_contactar_hasta,
--         baja_revocada_at; índices únicos por org para email_publico y
--         nombre+comuna normalizados (si hay duplicados: WARNING y no se crea).
--      9. 'baja' solo se revoca vía revoke_prospect_baja(prospect_id, motivo)
--         (owner/admin; ver C9).
--     10. convert_prospect_to_client(prospect_id, plan_key, mrr_clp).
--     11. append_prospect_note(prospect_id, text): solo service_role.
--   D. Propuestas (PR #18)
--     12. payments.proposal_id (FK, mismo cliente) + un cobro por propuesta.
--     13. proposals.accepted_rut; accept_proposal(..., _rut, _extra_text).
--     14. Trigger: amount_clp se recalcula desde items; items solo cambia en
--         borrador (ver D14).
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
--   - La server fn ADEMÁS debe: contar los objetos ya subidos bajo
--     "<client_id>/" y negar si hay 20 o más; limitar la tasa por IP y por
--     token; y forzar nombres ASCII (safeName = [A-Za-z0-9._-], sin espacios
--     ni "..", máx. 100 caracteres; el resto se reemplaza por "-").
--   - Lectura: editores del cliente (can_edit_client) pueden leer objetos
--     "<client_id>/..." (createSignedUrl desde la app).
--   - Límite del bucket: 10 MB y tipos PDF/PNG/JPEG/WEBP (sin SVG: puede
--     llevar scripts; sin ZIP: no se puede inspeccionar). Archivos subidos y
--     nunca enviados quedan huérfanos; limpiarlos con un job de servidor si
--     llega a importar.
--   - links_redes: la BD solo acepta "https?://..." o un usuario
--     (@?[A-Za-z0-9._-]). La UI que los muestre debe igualmente validar el
--     esquema http(s) antes de usarlos en href (src/lib/onboarding/links.ts).
--
-- Orden de despliegue:
--   1. Aplicar ESTE archivo (aditivo: el código actual sigue funcionando).
--   2. Integrar y publicar el código del PR (usa set_payment_status).
--   3. Aplicar 20261010000100_platform_v3b_payments_lockdown.sql.
-- Cada archivo: UNA sola vez, FUERA DE HORARIO, vía Lovable ("aplica la
-- migración supabase/migrations/<archivo> tal cual") o pegándolo completo en
-- el SQL editor de Supabase (una sola transacción). Idempotentes.
--
-- Después de aplicar, revisar los WARNING (índices de prospects no creados
-- por duplicados) con:
--   SELECT i AS indice, to_regclass('public.' || i) IS NOT NULL AS creado
--   FROM unnest(ARRAY['prospects_org_email_uk', 'prospects_org_nombre_comuna_uk']) AS i;
-- Si alguno sale false: unificar los duplicados (el WARNING lista los ids)
-- y re-ejecutar este archivo.
--
-- Propuestas existentes con items en formato antiguo o cuyo amount_clp no
-- cuadra con items (el trigger D14 solo valida cuando items cambia):
--   SELECT id, status, amount_clp, items FROM public.proposals
--   WHERE jsonb_typeof(items) <> 'array'
--      OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(items) = 'array' THEN items ELSE '[]' END) it
--                 WHERE jsonb_typeof(it) <> 'object' OR jsonb_typeof(it->'amount') IS DISTINCT FROM 'number'
--                    OR coalesce(it->>'billing', '') NOT IN ('one_time', 'monthly'))
--      OR amount_clp IS DISTINCT FROM (
--           SELECT coalesce(sum((it->>'amount')::numeric), 0)::integer
--           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(items) = 'array' THEN items ELSE '[]' END) it
--           WHERE jsonb_typeof(it) = 'object' AND jsonb_typeof(it->'amount') = 'number');
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
  'Datos del onboarding público (1:1 con clients). Escribe solo submit_onboarding() / service_role; leen editores (can_edit_client).';
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
  USING (public.can_edit_client(client_id));

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
        IF t !~ '^(https?://[^\s<>"]+|@?[A-Za-z0-9._-]{1,100})$' THEN
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
          ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
  ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

  -- Solo lectura para editores del cliente ("<client_id>/archivo").
  -- Sin policies de INSERT/UPDATE/DELETE: la subida usa createSignedUploadUrl
  -- (service role) y no pasa por RLS de anon/authenticated.
  DROP POLICY IF EXISTS "onboarding members read" ON storage.objects;
  DROP POLICY IF EXISTS "onboarding editors read" ON storage.objects;
  CREATE POLICY "onboarding editors read" ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'onboarding'
      AND public.can_edit_client(
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
-- Bloquea si el cobro ya está pagado o tiene (o tuvo) flow_token: Flow cobra
-- el monto original y el pago no podría conciliarse. Aplica a anon y
-- authenticated (navegador); el servidor (service_role) y las funciones
-- SECURITY DEFINER no se bloquean. Para otro monto: cancelar y crear otro.
CREATE OR REPLACE FUNCTION public.lock_amount_with_flow_order()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (OLD.status = 'paid' OR OLD.flow_token IS NOT NULL)
     AND (NEW.amount IS DISTINCT FROM OLD.amount OR NEW.currency IS DISTINCT FROM OLD.currency) THEN
    RAISE EXCEPTION 'No se puede cambiar el monto de un cobro pagado o con link de pago'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.lock_amount_with_flow_order() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_payments_lock_amount ON public.payments;
CREATE TRIGGER t_payments_lock_amount BEFORE UPDATE OF amount, currency ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.lock_amount_with_flow_order();


-- =====================================================================
-- B7. set_payment_status() (el cierre de columnas está en v3b)
-- =====================================================================
-- Cambio de estado manual. Solo owner/admin (manages_client), igual que la
-- policy de UPDATE de payments. Transiciones válidas:
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
  IF cid IS NULL OR NOT public.manages_client(cid) THEN
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
  IF allowed IS NOT TRUE THEN
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
  'Cuándo se revocó la última baja (solo la escribe revoke_prospect_baja()).';

CREATE INDEX IF NOT EXISTS prospects_client_idx ON public.prospects (client_id) WHERE client_id IS NOT NULL;

-- Estado 'frio': guardado, no se insiste automáticamente, se puede retomar a
-- mano cuando haga sentido (a diferencia de 'baja', que es "nunca más" y
-- sigue protegida por el guard de C9). Se reemplaza el CHECK de v2 por uno
-- que incluye 'frio' (NOT VALID + VALIDATE: no bloquea escrituras al validar).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.prospects'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%estado%'
      AND pg_get_constraintdef(oid) NOT LIKE '%frio%'
  LOOP
    EXECUTE format('ALTER TABLE public.prospects DROP CONSTRAINT %I', r.conname);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prospects_estado_chk' AND conrelid = 'public.prospects'::regclass) THEN
    ALTER TABLE public.prospects ADD CONSTRAINT prospects_estado_chk CHECK (estado IN
      ('nuevo', 'contactado', 'respondio', 'demo', 'propuesta', 'ganado', 'perdido', 'baja', 'frio')) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.prospects VALIDATE CONSTRAINT prospects_estado_chk;

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
-- Un prospecto en 'baja' solo sale de 'baja' vía revoke_prospect_baja()
-- (owner/admin de la org, con motivo). Ningún UPDATE directo lo logra, ni
-- siquiera con service_role ni poniendo baja_revocada_at a mano: el trigger
-- exige la marca transaccional que pone la RPC (set_config local a la
-- transacción; la API REST no permite fijarla).
-- Al pasar a 'baja' se limpia baja_revocada_at; mientras está en 'baja' no
-- se puede escribir.
-- App: el checkbox "retiró su solicitud de baja" del Sheet de prospectos
-- (PR #15) deberá llamar a esta RPC en un PR siguiente; mientras tanto el
-- guard bloquea la salida de baja (el Sheet muestra el error al guardar).
CREATE OR REPLACE FUNCTION public.guard_prospect_baja()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.estado = 'baja' THEN
    IF TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'baja' THEN
      NEW.baja_revocada_at := NULL;
    ELSE
      NEW.baja_revocada_at := OLD.baja_revocada_at;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.estado = 'baja'
     AND coalesce(current_setting('vibranding.revoke_baja', true), '') <> OLD.id::text THEN
    RAISE EXCEPTION 'El prospecto pidió la baja: solo un owner/admin puede revocarla con revoke_prospect_baja()'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_prospect_baja() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_prospects_baja_guard ON public.prospects;
CREATE TRIGGER t_prospects_baja_guard BEFORE INSERT OR UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.guard_prospect_baja();

-- Revoca la baja: owner/admin de la org (is_org_manager). Motivo obligatorio
-- (5..300 caracteres, saneado); queda en notas con fecha y usuario.
-- _estado: al que vuelve (por defecto 'nuevo'; no 'baja' ni 'ganado').
CREATE OR REPLACE FUNCTION public.revoke_prospect_baja(
  _prospect_id uuid,
  _motivo text,
  _estado text DEFAULT 'nuevo'
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  oid_ uuid;
  pr public.prospects%ROWTYPE;
  motivo text;
  line text;
BEGIN
  SELECT org_id INTO oid_ FROM public.prospects WHERE id = _prospect_id;
  IF oid_ IS NULL OR NOT public.is_org_manager(oid_) THEN
    RAISE EXCEPTION 'No tienes permisos para esta acción' USING ERRCODE = '42501';
  END IF;

  motivo := left(btrim(regexp_replace(coalesce(_motivo, ''), '[[:cntrl:]\s]+', ' ', 'g')), 300);
  IF length(motivo) < 5 THEN
    RAISE EXCEPTION 'Indica el motivo (mínimo 5 caracteres)' USING ERRCODE = '22023';
  END IF;
  IF _estado IS NULL OR _estado NOT IN ('nuevo', 'contactado', 'respondio', 'demo', 'propuesta', 'perdido', 'frio') THEN
    RAISE EXCEPTION 'Estado inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO pr FROM public.prospects WHERE id = _prospect_id FOR UPDATE;
  IF pr.estado <> 'baja' THEN
    RETURN jsonb_build_object('ok', true, 'changed', false, 'estado', pr.estado);
  END IF;

  line := format('[%s] Baja revocada por %s: %s',
                 to_char(now() AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD HH24:MI'),
                 coalesce(auth.uid()::text, 'sistema'), motivo);

  PERFORM set_config('vibranding.revoke_baja', pr.id::text, true);
  UPDATE public.prospects
     SET estado = _estado,
         baja_revocada_at = now(),
         notas = right(CASE WHEN coalesce(notas, '') = '' THEN line ELSE notas || E'\n' || line END, 20000)
   WHERE id = pr.id;
  PERFORM set_config('vibranding.revoke_baja', '', true);

  RETURN jsonb_build_object('ok', true, 'changed', true, 'estado', _estado);
END $$;

REVOKE ALL ON FUNCTION public.revoke_prospect_baja(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_prospect_baja(uuid, text, text) TO authenticated, service_role;


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


-- =====================================================================
-- C11. append_prospect_note(): nota de sistema en prospects.notas
-- =====================================================================
-- Solo servidor (service_role), p. ej. "aceptó la propuesta X" cuando la
-- propuesta es de un prospecto. Atómico (un solo UPDATE, sin leer-modificar-
-- escribir en la app). La línea se sanea: sin \r \n \t ni caracteres de
-- control, espacios colapsados, máx. 300 caracteres. notas guarda como mucho
-- los últimos 20.000 caracteres. Devuelve false si el prospecto no existe.
CREATE OR REPLACE FUNCTION public.append_prospect_note(_prospect_id uuid, _note text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE line text; n integer;
BEGIN
  line := left(btrim(regexp_replace(coalesce(_note, ''), '[[:cntrl:]\s]+', ' ', 'g')), 300);
  IF _prospect_id IS NULL OR line = '' THEN
    RAISE EXCEPTION 'prospect_id y nota son obligatorios' USING ERRCODE = '22023';
  END IF;
  UPDATE public.prospects
     SET notas = right(CASE WHEN coalesce(notas, '') = '' THEN line ELSE notas || E'\n' || line END, 20000)
   WHERE id = _prospect_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

REVOKE ALL ON FUNCTION public.append_prospect_note(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_prospect_note(uuid, text) TO service_role;


-- =====================================================================
-- D12. payments.proposal_id: un cobro por propuesta
-- =====================================================================
-- Lo escribe solo el servidor al aceptar (tras v3b no está en los GRANT por
-- columna de authenticated).
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_proposal_uk
  ON public.payments (proposal_id) WHERE proposal_id IS NOT NULL;

-- La propuesta debe ser del mismo cliente del cobro (y por lo tanto de la misma org).
CREATE OR REPLACE FUNCTION public.enforce_payment_proposal_client()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.proposal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.proposals pr
    WHERE pr.id = NEW.proposal_id AND pr.client_id = NEW.client_id
  ) THEN
    RAISE EXCEPTION 'proposal_id % no pertenece al cliente %', NEW.proposal_id, NEW.client_id;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.enforce_payment_proposal_client() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_payments_proposal_client ON public.payments;
CREATE TRIGGER t_payments_proposal_client BEFORE INSERT OR UPDATE OF proposal_id, client_id ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_proposal_client();


-- =====================================================================
-- D13. accepted_rut + accept_proposal extendida
-- =====================================================================
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS accepted_rut text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proposals_accepted_rut_chk' AND conrelid = 'public.proposals'::regclass) THEN
    ALTER TABLE public.proposals ADD CONSTRAINT proposals_accepted_rut_chk
      CHECK (accepted_rut IS NULL OR accepted_rut ~ '^[0-9]{7,8}-[0-9K]$') NOT VALID;
  END IF;
END $$;
ALTER TABLE public.proposals VALIDATE CONSTRAINT proposals_accepted_rut_chk;

-- Mismo guard de v2 + accepted_rut: desde el navegador nadie lo escribe.
CREATE OR REPLACE FUNCTION public.guard_proposal_acceptance()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'aceptada' OR NEW.accepted_at IS NOT NULL OR NEW.accepted_name IS NOT NULL
       OR NEW.accepted_ip_hash IS NOT NULL OR NEW.accepted_text IS NOT NULL OR NEW.accepted_rut IS NOT NULL THEN
      RAISE EXCEPTION 'la aceptación solo se registra vía accept_proposal()';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'aceptada' THEN
    RAISE EXCEPTION 'una propuesta aceptada no se puede modificar';
  END IF;

  IF NEW.status = 'aceptada'
     OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
     OR NEW.accepted_name IS DISTINCT FROM OLD.accepted_name
     OR NEW.accepted_ip_hash IS DISTINCT FROM OLD.accepted_ip_hash
     OR NEW.accepted_text IS DISTINCT FROM OLD.accepted_text
     OR NEW.accepted_rut IS DISTINCT FROM OLD.accepted_rut THEN
    RAISE EXCEPTION 'la aceptación solo se registra vía accept_proposal()';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_proposal_acceptance() FROM PUBLIC, anon, authenticated;

-- Se reemplaza la firma de 3 argumentos por una de 5 con DEFAULT: las
-- llamadas existentes (rpc con _token/_name/_ip_hash) siguen funcionando.
-- No pueden convivir las dos: una llamada con 3 argumentos sería ambigua.
DROP FUNCTION IF EXISTS public.accept_proposal(text, text, text);

CREATE OR REPLACE FUNCTION public.accept_proposal(
  _token text,
  _name text,
  _ip_hash text,
  _rut text DEFAULT NULL,
  _extra_text text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE p public.proposals%ROWTYPE; nm text; txt text; rut_norm text; extra text;
BEGIN
  IF _token IS NULL OR _token !~ '^[0-9a-f]{48}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  nm := left(btrim(coalesce(_name, '')), 120);
  IF length(nm) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_required');
  END IF;

  IF nullif(btrim(coalesce(_rut, '')), '') IS NOT NULL THEN
    IF NOT private.rut_is_valid(btrim(_rut)) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_rut');
    END IF;
    rut_norm := upper(replace(replace(btrim(_rut), '.', ''), '-', ''));
    rut_norm := left(rut_norm, length(rut_norm) - 1) || '-' || right(rut_norm, 1);
  END IF;

  -- Texto adicional (condiciones aceptadas): sin caracteres de control salvo
  -- saltos de línea, máx. 4000.
  extra := nullif(btrim(left(regexp_replace(coalesce(_extra_text, ''), '[\x01-\x09\x0B-\x1F\x7F]+', ' ', 'g'), 4000)), '');

  SELECT * INTO p FROM public.proposals WHERE token = _token AND status <> 'borrador' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  IF p.status = 'aceptada' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'accepted_at', p.accepted_at);
  END IF;
  IF p.status NOT IN ('enviada', 'vista') THEN
    RETURN jsonb_build_object('ok', false, 'reason', p.status);
  END IF;
  IF p.expires_at IS NOT NULL AND p.expires_at <= now() THEN
    UPDATE public.proposals SET status = 'expirada' WHERE id = p.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expirada');
  END IF;

  txt := format(
    'Yo, %s, acepto la propuesta "%s" (plan %s) por un total de %s CLP, con el detalle: %s. Aceptada el %s (America/Santiago).',
    nm,
    coalesce(p.title, 'Propuesta VIBRANDING'),
    coalesce(p.plan_key, 'a medida'),
    p.amount_clp,
    p.items::text,
    to_char(now() AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD HH24:MI:SS')
  );
  IF rut_norm IS NOT NULL THEN
    txt := txt || E'\nRUT declarado: ' || rut_norm || '.';
  END IF;
  IF extra IS NOT NULL THEN
    txt := txt || E'\n' || extra;
  END IF;

  UPDATE public.proposals
     SET status = 'aceptada',
         accepted_at = now(),
         accepted_name = nm,
         accepted_rut = rut_norm,
         accepted_ip_hash = left(nullif(btrim(coalesce(_ip_hash, '')), ''), 128),
         accepted_text = txt
   WHERE id = p.id;

  RETURN jsonb_build_object('ok', true, 'already', false, 'accepted_at', now());
END $$;

REVOKE ALL ON FUNCTION public.accept_proposal(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_proposal(text, text, text, text, text) TO service_role;


-- =====================================================================
-- D14. amount_clp se recalcula desde items
-- =====================================================================
-- Decisión: RECALCULAR (no rechazar). amount_clp = primer pago = suma de
-- ítems 'one_time' + suma de ítems 'monthly' (mismo cálculo que
-- computeTotals en src/lib/proposals/model.ts). Así el monto que se acepta y
-- se cobra nunca se desalinea del detalle, venga de donde venga el write
-- (navegador o servidor). Lo que se rechaza (22023) es un items mal formado:
--   - más de 20 ítems; ítem que no sea objeto;
--   - type distinto de plan|extra; label vacío o > 120;
--   - amount no entero o fuera de ±50.000.000; billing distinto de one_time|monthly;
--   - plan con monto negativo; total único o mensual negativo.
-- items vacío => amount_clp = 0.
-- UPDATE: items solo se puede cambiar mientras la propuesta está en
-- 'borrador' (lo enviado al cliente no cambia). Si items no cambia, no se
-- valida (propuestas con items en formato antiguo siguen editables en otros
-- campos) y amount_clp conserva su valor (no se edita a mano).
CREATE OR REPLACE FUNCTION public.proposal_recalc_amount()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  it jsonb;
  amt numeric;
  one_time bigint := 0;
  monthly bigint := 0;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.items IS NOT DISTINCT FROM OLD.items THEN
      NEW.amount_clp := OLD.amount_clp;
      RETURN NEW;
    END IF;
    IF OLD.status <> 'borrador' THEN
      RAISE EXCEPTION 'items solo se puede cambiar en una propuesta en borrador' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) <> 'array' THEN
    RAISE EXCEPTION 'items debe ser una lista' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(NEW.items) > 20 THEN
    RAISE EXCEPTION 'items: máximo 20 líneas' USING ERRCODE = '22023';
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
    IF jsonb_typeof(it) <> 'object'
       OR coalesce(it->>'type', '') NOT IN ('plan', 'extra')
       OR jsonb_typeof(it->'label') IS DISTINCT FROM 'string'
       OR length(btrim(it->>'label')) NOT BETWEEN 1 AND 120
       OR jsonb_typeof(it->'amount') IS DISTINCT FROM 'number'
       OR coalesce(it->>'billing', '') NOT IN ('one_time', 'monthly') THEN
      RAISE EXCEPTION 'items: línea mal formada (%)', left(it::text, 200) USING ERRCODE = '22023';
    END IF;
    amt := (it->>'amount')::numeric;
    IF amt <> trunc(amt) OR abs(amt) > 50000000 THEN
      RAISE EXCEPTION 'items: monto inválido (%)', it->>'amount' USING ERRCODE = '22023';
    END IF;
    IF it->>'type' = 'plan' AND amt < 0 THEN
      RAISE EXCEPTION 'items: el plan no puede tener monto negativo' USING ERRCODE = '22023';
    END IF;
    IF it->>'billing' = 'monthly' THEN monthly := monthly + amt::bigint;
    ELSE one_time := one_time + amt::bigint;
    END IF;
  END LOOP;

  IF one_time < 0 OR monthly < 0 THEN
    RAISE EXCEPTION 'items: los descuentos no pueden dejar un total negativo' USING ERRCODE = '22023';
  END IF;

  NEW.amount_clp := (one_time + monthly)::integer;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.proposal_recalc_amount() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_proposals_amount ON public.proposals;
CREATE TRIGGER t_proposals_amount BEFORE INSERT OR UPDATE OF items, amount_clp ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.proposal_recalc_amount();
