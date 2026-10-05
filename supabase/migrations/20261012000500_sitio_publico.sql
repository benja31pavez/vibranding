-- Guardado atómico del multienlace (perfil + enlaces + orden) en una sola transacción.
-- Idempotente: CREATE OR REPLACE + REVOKE/GRANT. No toca el CHECK de multilink_items.kind
-- (en la BD ya admite 'link','whatsapp','video','social','platform').
-- El front usa esta función si existe y, si todavía no se aplica (PGRST202 / 42883),
-- cae al guardado por partes.

CREATE OR REPLACE FUNCTION public.save_multilink(
  _page_id uuid,
  _profile jsonb,
  _items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _client_id uuid;
  _slug text;
  _item jsonb;
  _ord integer := 0;
  _id uuid;
  _kind text;
  _url text;
  _video text;
  _thumb text;
  _wa text;
  _keep uuid[] := ARRAY[]::uuid[];
  -- Esquemas permitidos (comparación sin distinguir mayúsculas con ~*).
  _link constant text := '^(https?://[^\s/]+\.[^\s]+|mailto:[^\s@]+@[^\s@]+\.[^\s@]+|tel:\+?[0-9 ().-]{6,20})$';
  _img constant text := '^https://[^\s/]+\.[^\s]+$';
  _scheme constant text := '^[a-z][a-z0-9+.-]*:';
  _uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  _max_url constant integer := 2000;
BEGIN
  -- Forma de los parámetros ----------------------------------------------
  IF jsonb_typeof(_profile) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'El perfil debe ser un objeto' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Los enlaces deben ser un arreglo' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(_items) > 100 THEN
    RAISE EXCEPTION 'Máximo 100 enlaces' USING ERRCODE = '22023';
  END IF;
  IF _profile ? 'background' AND jsonb_typeof(_profile->'background') IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'El fondo debe ser un objeto' USING ERRCODE = '22023';
  END IF;

  -- Permisos -------------------------------------------------------------
  SELECT m.client_id INTO _client_id FROM public.multilinks m WHERE m.id = _page_id FOR UPDATE;
  IF _client_id IS NULL THEN
    RAISE EXCEPTION 'Multienlace no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.can_edit_client(_client_id) THEN
    RAISE EXCEPTION 'Sin permiso para editar este cliente' USING ERRCODE = '42501';
  END IF;

  -- Perfil ---------------------------------------------------------------
  -- Mismo formato que slugify() del front: minúsculas, números, puntos y guiones.
  _slug := lower(trim(coalesce(_profile->>'slug', '')));
  IF _slug !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$' OR length(_slug) > 60 THEN
    RAISE EXCEPTION 'Dirección inválida' USING ERRCODE = '22023';
  END IF;
  IF length(trim(coalesce(_profile->>'title', ''))) = 0 THEN
    RAISE EXCEPTION 'Falta el nombre' USING ERRCODE = '22023';
  END IF;
  IF nullif(_profile->>'avatar_url', '') IS NOT NULL
     AND ((_profile->>'avatar_url') !~* _img OR length(_profile->>'avatar_url') > _max_url) THEN
    RAISE EXCEPTION 'Foto de perfil inválida (sólo https)' USING ERRCODE = '22023';
  END IF;
  IF nullif(_profile->'background'->>'url', '') IS NOT NULL
     AND ((_profile->'background'->>'url') !~* _img OR length(_profile->'background'->>'url') > _max_url) THEN
    RAISE EXCEPTION 'Imagen de fondo inválida (sólo https)' USING ERRCODE = '22023';
  END IF;
  IF coalesce(_profile->>'theme_color', '') !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'Color inválido' USING ERRCODE = '22023';
  END IF;

  BEGIN
    UPDATE public.multilinks SET
      title = left(trim(_profile->>'title'), 80),
      bio = nullif(left(trim(coalesce(_profile->>'bio', '')), 200), ''),
      avatar_url = nullif(_profile->>'avatar_url', ''),
      theme_color = _profile->>'theme_color',
      theme_mode = CASE WHEN _profile->>'theme_mode' = 'dark' THEN 'dark' ELSE 'light' END,
      button_style = coalesce(nullif(_profile->>'button_style', ''), button_style),
      button_shape = coalesce(nullif(_profile->>'button_shape', ''), button_shape),
      font_family = coalesce(nullif(_profile->>'font_family', ''), font_family),
      background = coalesce(_profile->'background', background),
      slug = _slug
    WHERE id = _page_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'La dirección ya está en uso' USING ERRCODE = '23505';
  END;

  -- Enlaces --------------------------------------------------------------
  FOR _item IN SELECT value FROM jsonb_array_elements(_items) LOOP
    IF jsonb_typeof(_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Enlace %: formato inválido', _ord + 1 USING ERRCODE = '22023';
    END IF;

    _kind := coalesce(nullif(_item->>'kind', ''), 'link');
    IF _kind NOT IN ('link', 'whatsapp', 'video', 'social', 'platform') THEN
      RAISE EXCEPTION 'Enlace %: tipo desconocido "%"', _ord + 1, left(_kind, 20) USING ERRCODE = '22023';
    END IF;

    _url := trim(coalesce(_item->>'url', ''));
    IF _url = 'https://' THEN _url := ''; END IF;
    _video := nullif(trim(coalesce(_item->>'video_url', '')), '');
    _thumb := nullif(trim(coalesce(_item->>'thumbnail_url', '')), '');

    IF length(trim(coalesce(_item->>'title', ''))) = 0 THEN
      RAISE EXCEPTION 'Enlace %: falta el texto del botón', _ord + 1 USING ERRCODE = '22023';
    END IF;
    IF length(_url) > _max_url OR length(coalesce(_video, '')) > _max_url OR length(coalesce(_thumb, '')) > _max_url THEN
      RAISE EXCEPTION 'Enlace %: URL demasiado larga', _ord + 1 USING ERRCODE = '22023';
    END IF;

    -- link / platform: URL obligatoria y con esquema permitido.
    IF _kind IN ('link', 'platform') AND _url !~* _link THEN
      RAISE EXCEPTION 'Enlace %: URL no permitida', _ord + 1 USING ERRCODE = '22023';
    END IF;
    -- social: acepta @usuario; si trae esquema, se valida como un enlace.
    IF _kind = 'social' AND (_url = '' OR (_url ~* _scheme AND _url !~* _link)) THEN
      RAISE EXCEPTION 'Enlace %: usuario o URL de red social inválida', _ord + 1 USING ERRCODE = '22023';
    END IF;
    -- whatsapp / video: la URL es opcional, pero si viene debe ser segura.
    IF _kind IN ('whatsapp', 'video') AND _url <> '' AND _url !~* _link THEN
      RAISE EXCEPTION 'Enlace %: URL no permitida', _ord + 1 USING ERRCODE = '22023';
    END IF;
    IF _kind = 'video' AND (_video IS NULL OR _video !~* _img) THEN
      RAISE EXCEPTION 'Enlace %: el video debe ser un enlace https://', _ord + 1 USING ERRCODE = '22023';
    END IF;
    IF _kind <> 'video' AND _video IS NOT NULL AND _video !~* _img THEN
      RAISE EXCEPTION 'Enlace %: video inválido (sólo https)', _ord + 1 USING ERRCODE = '22023';
    END IF;
    IF _thumb IS NOT NULL AND _thumb !~* _img THEN
      RAISE EXCEPTION 'Enlace %: miniatura inválida (sólo https)', _ord + 1 USING ERRCODE = '22023';
    END IF;

    -- WhatsApp normalizado a +569XXXXXXXX.
    _wa := regexp_replace(coalesce(_item->>'wa_number', ''), '\D', '', 'g');
    IF _wa ~ '^9[0-9]{8}$' THEN _wa := '56' || _wa; END IF;
    IF _kind = 'whatsapp' AND _wa !~ '^569[0-9]{8}$' THEN
      RAISE EXCEPTION 'Enlace %: WhatsApp inválido (+56 9 XXXX XXXX)', _ord + 1 USING ERRCODE = '22023';
    END IF;
    _wa := CASE WHEN _wa ~ '^569[0-9]{8}$' THEN '+' || _wa ELSE nullif(_item->>'wa_number', '') END;

    _id := NULL;
    IF lower(coalesce(_item->>'id', '')) ~ _uuid THEN
      SELECT i.id INTO _id FROM public.multilink_items i
       WHERE i.id = (_item->>'id')::uuid AND i.multilink_id = _page_id;
    END IF;

    IF _id IS NULL THEN
      INSERT INTO public.multilink_items (
        multilink_id, client_id, title, url, icon, sort_order, is_active, kind, featured,
        subtitle, thumbnail_url, wa_number, wa_message, video_url, start_at, end_at
      ) VALUES (
        _page_id, _client_id, left(trim(_item->>'title'), 80), _url, nullif(left(_item->>'icon', 40), ''), _ord,
        coalesce((_item->>'is_active')::boolean, true), _kind, coalesce((_item->>'featured')::boolean, false),
        nullif(left(_item->>'subtitle', 120), ''), _thumb, _wa,
        nullif(left(_item->>'wa_message', 300), ''), _video,
        nullif(_item->>'start_at', '')::timestamptz, nullif(_item->>'end_at', '')::timestamptz
      ) RETURNING id INTO _id;
    ELSE
      UPDATE public.multilink_items SET
        title = left(trim(_item->>'title'), 80),
        url = _url,
        icon = nullif(left(_item->>'icon', 40), ''),
        sort_order = _ord,
        is_active = coalesce((_item->>'is_active')::boolean, true),
        kind = _kind,
        featured = coalesce((_item->>'featured')::boolean, false),
        subtitle = nullif(left(_item->>'subtitle', 120), ''),
        thumbnail_url = _thumb,
        wa_number = _wa,
        wa_message = nullif(left(_item->>'wa_message', 300), ''),
        video_url = _video,
        start_at = nullif(_item->>'start_at', '')::timestamptz,
        end_at = nullif(_item->>'end_at', '')::timestamptz
      WHERE id = _id;
    END IF;

    _keep := _keep || _id;
    _ord := _ord + 1;
  END LOOP;

  DELETE FROM public.multilink_items
   WHERE multilink_id = _page_id AND NOT (id = ANY (_keep));

  RETURN jsonb_build_object(
    'items',
    coalesce(
      (SELECT jsonb_agg(to_jsonb(i) ORDER BY i.sort_order)
         FROM public.multilink_items i WHERE i.multilink_id = _page_id),
      '[]'::jsonb
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_multilink(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_multilink(uuid, jsonb, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.save_multilink(uuid, jsonb, jsonb) IS
  'Guarda perfil y enlaces del multienlace en una transacción. Valida permisos (can_edit_client), forma de los datos y esquemas de URL.';
