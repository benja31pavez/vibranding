-- =====================================================================
-- Archivos del cliente · subir y eliminar con autoría (agencia / cliente)
-- =====================================================================
-- APLICAR ANTES de publicar el código del PR "Archivos: subir y eliminar":
-- la página llama a las RPC client_files_usage / register_client_file /
-- delete_client_file y lee public.client_files. Sin esta migración el botón
-- "Subir archivo" falla con un mensaje claro y el resto de la página sigue
-- funcionando (las server functions toleran la tabla ausente al listar).
--
-- Qué hace:
--   1. public.client_files: archivos subidos directamente en "Archivos".
--      Viven en el bucket privado 'onboarding' bajo
--      'archivos/<client_id>/<uuid>.<ext>' (CHECK). Guardan autoría:
--      uploaded_by (auth.users) y uploader_kind ('agency' | 'client').
--   2. RLS: SELECT para quien ve al cliente (agencia de la org dueña o el
--      usuario cliente de ESE cliente). Sin INSERT/UPDATE/DELETE para el
--      navegador: solo por las RPC de abajo (SECURITY DEFINER).
--   3. register_client_file(client, path, name): registra un objeto ya subido.
--      El tipo de autor sale de auth.uid() (nunca del input): editor de la
--      agencia (can_edit_client) → 'agency'; usuario cliente de ese cliente
--      (user_client_id()) → 'client'; cualquier otro → 42501. Lee tamaño y
--      MIME reales de storage.objects, valida tope por archivo (200 MB),
--      tipos permitidos y la CUOTA de 5 GB por cliente (client_files + lo que
--      el cliente subió en el onboarding) con un lock por cliente.
--   4. delete_client_file(client, id): la agencia (editor) solo borra archivos con
--      uploader_kind = 'agency'; el usuario cliente solo los 'client' de su
--      propio cliente. Devuelve el path para que el servidor borre el objeto.
--   5. client_files_usage(client): bytes usados (para la UI y el pre-chequeo).
--   6. list_onboarding_orphans: misma función vigente en producción
--      (20261012002400, con la exclusión de payments.document_path) + no barre
--      'archivos/...' referenciados por client_files. Un objeto subido pero
--      nunca registrado (o cuyo registro se eliminó) sí se barre a las 48 h.
--   7. Onboarding público: private.parse_onboarding_payload() (la usa
--      submit_onboarding) valida el tamaño REAL de cada archivo (máx. 10 MB) y
--      que la ruta sea del onboarding ('<client_id>/…', nunca 'archivos/' ni
--      'documentos/'). Si excede, el envío se rechaza con mensaje claro y el
--      objeto, sin referencia, lo barre la limpieza diaria.
--   8. Bucket 'onboarding': file_size_limit 10 MB → 200 MB (el bucket ya
--      existe; no se crean buckets). El tope de 10 MB del onboarding queda en
--      la app, su server function y la BD (punto 7).
--
-- Idempotente.
-- =====================================================================

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------- tabla

CREATE TABLE IF NOT EXISTS public.client_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  path text NOT NULL UNIQUE,
  name text NOT NULL,
  size bigint NOT NULL,
  mime text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploader_kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_files_kind_chk CHECK (uploader_kind IN ('agency', 'client')),
  CONSTRAINT client_files_path_chk CHECK (
    path ~ ('^archivos/' || client_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$')
  ),
  CONSTRAINT client_files_name_chk CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  CONSTRAINT client_files_size_chk CHECK (size > 0 AND size <= 209715200),
  CONSTRAINT client_files_mime_chk CHECK (char_length(mime) BETWEEN 3 AND 120)
);

COMMENT ON TABLE public.client_files IS
  'Archivos subidos en la sección Archivos (bucket privado onboarding, archivos/<client_id>/...). Escritura solo por RPC.';
COMMENT ON COLUMN public.client_files.uploader_kind IS
  'agency = lo subió un editor de la agencia; client = lo subió el usuario cliente. Define quién puede borrarlo.';

CREATE INDEX IF NOT EXISTS client_files_client_idx
  ON public.client_files (client_id, created_at DESC);

ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_files select" ON public.client_files;
CREATE POLICY "client_files select" ON public.client_files
  FOR SELECT TO authenticated
  USING (public.owns_client(client_id) OR client_id = public.user_client_id());

-- Sin policies de escritura: además, sin grants de escritura para el navegador.
REVOKE ALL ON public.client_files FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.client_files FROM authenticated;
GRANT SELECT ON public.client_files TO authenticated;
GRANT ALL ON public.client_files TO service_role;

-- ---------------------------------------------------------------- helpers

-- Tipo de autor del usuario actual para ESTE cliente (NULL = sin permiso de subir).
CREATE OR REPLACE FUNCTION private.client_file_actor_kind(_client_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _client_id IS NULL THEN NULL
    WHEN public.can_edit_client(_client_id) THEN 'agency'
    WHEN _client_id = public.user_client_id() THEN 'client'
    ELSE NULL
  END
$$;
REVOKE ALL ON FUNCTION private.client_file_actor_kind(uuid) FROM PUBLIC, anon, authenticated;

-- Bytes usados por el cliente: archivos registrados + lo subido en el onboarding.
CREATE OR REPLACE FUNCTION private.client_files_used_bytes(_client_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((SELECT sum(f.size) FROM public.client_files f WHERE f.client_id = _client_id), 0)
       + COALESCE((
           SELECT sum(COALESCE((o.metadata->>'size')::bigint, 0))
           FROM storage.objects o
           WHERE o.bucket_id = 'onboarding'
             AND o.name LIKE _client_id::text || '/%'
         ), 0)
$$;
REVOKE ALL ON FUNCTION private.client_files_used_bytes(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- RPC

CREATE OR REPLACE FUNCTION public.client_files_usage(_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT COALESCE(public.owns_client(_client_id) OR _client_id = public.user_client_id(), false) THEN
    RAISE EXCEPTION 'No tienes acceso a este cliente' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'used', private.client_files_used_bytes(_client_id),
    'limit', 5368709120::bigint,
    'kind', private.client_file_actor_kind(_client_id)
  );
END $$;
REVOKE ALL ON FUNCTION public.client_files_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_files_usage(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.register_client_file(_client_id uuid, _path text, _name text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  kind text;
  obj_size bigint;
  obj_mime text;
  used bigint;
  quota constant bigint := 5368709120;      -- 5 GB por cliente
  max_file constant bigint := 209715200;    -- 200 MB por archivo
  clean_name text := left(btrim(COALESCE(_name, '')), 160);
  new_id uuid;
BEGIN
  kind := private.client_file_actor_kind(_client_id);
  IF kind IS NULL THEN
    RAISE EXCEPTION 'No tienes permiso para subir archivos a este cliente' USING ERRCODE = '42501';
  END IF;
  IF _path IS NULL OR _path !~ ('^archivos/' || _client_id::text
       || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{2,5}$') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_path');
  END IF;
  IF clean_name = '' THEN
    clean_name := 'archivo';
  END IF;

  -- Un registro a la vez por cliente: la cuota no se puede saltar en paralelo.
  PERFORM 1 FROM public.clients WHERE id = _client_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.client_files WHERE path = _path) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate');
  END IF;

  SELECT COALESCE((o.metadata->>'size')::bigint, 0), lower(COALESCE(o.metadata->>'mimetype', ''))
    INTO obj_size, obj_mime
  FROM storage.objects o
  WHERE o.bucket_id = 'onboarding' AND o.name = _path;
  IF NOT FOUND OR obj_size <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing');
  END IF;
  IF obj_size > max_file THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_big');
  END IF;
  IF obj_mime NOT IN (
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/pdf', 'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_type');
  END IF;

  -- El objeto ya está en storage pero aún no en client_files: se suma aparte.
  used := private.client_files_used_bytes(_client_id);
  IF used + obj_size > quota THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quota', 'used', used, 'limit', quota);
  END IF;

  INSERT INTO public.client_files (client_id, path, name, size, mime, uploaded_by, uploader_kind)
  VALUES (_client_id, _path, clean_name, obj_size, obj_mime, auth.uid(), kind)
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'id', new_id, 'kind', kind, 'size', obj_size);
END $$;
REVOKE ALL ON FUNCTION public.register_client_file(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_client_file(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_client_file(_client_id uuid, _id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  f public.client_files%ROWTYPE;
  allowed boolean;
BEGIN
  SELECT * INTO f FROM public.client_files WHERE id = _id AND client_id = _client_id FOR UPDATE;
  -- Mismo error si no existe o no es tuyo: no revela qué ids existen.
  IF NOT FOUND
     OR NOT COALESCE(public.owns_client(f.client_id) OR f.client_id = public.user_client_id(), false) THEN
    RAISE EXCEPTION 'Archivo no encontrado' USING ERRCODE = '42501';
  END IF;

  allowed := CASE f.uploader_kind
    WHEN 'agency' THEN public.can_edit_client(f.client_id)
    WHEN 'client' THEN f.client_id = public.user_client_id()
    ELSE false
  END;
  IF NOT COALESCE(allowed, false) THEN
    RAISE EXCEPTION 'Solo puedes eliminar archivos que subiste tú' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.client_files WHERE id = f.id;
  RETURN jsonb_build_object('ok', true, 'client_id', f.client_id, 'path', f.path);
END $$;
REVOKE ALL ON FUNCTION public.delete_client_file(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_client_file(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------- limpieza

-- Misma función que 20261012002400 + exclusión de archivos/... registrados.
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
    AND NOT EXISTS (
      SELECT 1 FROM public.client_files cf WHERE cf.path = o.name)
  ORDER BY o.created_at
  LIMIT lim - n;
END $$;
REVOKE ALL ON FUNCTION public.list_onboarding_orphans(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_onboarding_orphans(integer) TO service_role;

-- ---------------------------------------------------------------- onboarding público

-- Misma función que 20261010000000_platform_v3 (vigente en producción) + tope
-- de 10 MB por archivo con el tamaño REAL (storage.objects.metadata->>'size')
-- y rechazo explícito de rutas 'archivos/' y 'documentos/'. submit_onboarding()
-- no cambia: atrapa el error (22023) y responde invalid_payload con el mensaje.
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
  obj_size bigint;
  -- Onboarding público: 10 MB por archivo (el bucket admite 200 MB por "Archivos").
  max_onboarding_file constant bigint := 10485760;
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
      -- Nunca rutas de "Archivos" ni de documentos tributarios (defensa extra al prefijo).
      IF t LIKE 'archivos/%' OR t LIKE 'documentos/%' THEN
        RAISE EXCEPTION 'archivos: path inválido' USING ERRCODE = '22023';
      END IF;
      SELECT COALESCE((o.metadata->>'size')::bigint, 0) INTO obj_size
        FROM storage.objects o WHERE o.bucket_id = 'onboarding' AND o.name = t;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'archivos: % no existe en el bucket', t USING ERRCODE = '22023';
      END IF;
      -- Tamaño REAL del objeto: una subida manipulada no puede superar 10 MB.
      -- El objeto rechazado queda sin referencia y la limpieza diaria lo borra.
      IF obj_size > max_onboarding_file THEN
        RAISE EXCEPTION 'archivos: un archivo supera 10 MB; súbelo de nuevo más liviano' USING ERRCODE = '22023';
      END IF;
      -- Debe venir de reserve_onboarding_upload() para este cliente (A4).
      IF NOT EXISTS (SELECT 1 FROM public.onboarding_upload_reservations ur
                     WHERE ur.path = t AND ur.client_id = _client_id) THEN
        RAISE EXCEPTION 'archivos: % no fue reservado para este onboarding', t USING ERRCODE = '22023';
      END IF;
      IF NOT t = ANY (r.archivos) THEN
        r.archivos := r.archivos || t;
      END IF;
    END LOOP;
  END IF;

  RETURN r;
END $$;

REVOKE ALL ON FUNCTION private.parse_onboarding_payload(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- bucket

-- 200 MB por archivo (antes 10 MB). Sin crear buckets; sigue privado.
UPDATE storage.buckets
   SET file_size_limit = 209715200
 WHERE id = 'onboarding'
   AND (file_size_limit IS NULL OR file_size_limit < 209715200);
