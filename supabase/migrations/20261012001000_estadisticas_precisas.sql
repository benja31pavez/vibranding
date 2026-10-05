-- Estadísticas precisas del landing (aditiva; RLS sin cambios).
--
SET LOCAL lock_timeout = '5s';

-- 1) Columnas ---------------------------------------------------------------
ALTER TABLE public.landing_events
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS visitor_hash text,
  ADD COLUMN IF NOT EXISTS referrer_domain text,
  ADD COLUMN IF NOT EXISTS landing_path text,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS has_gclid boolean,
  ADD COLUMN IF NOT EXISTS has_fbclid boolean,
  ADD COLUMN IF NOT EXISTS cta text;

-- NOT VALID evita recorrer la tabla con el lock tomado; como hoy es pequeña
-- (≈12 filas) se valida en el mismo archivo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'landing_events_device_type_chk'
  ) THEN
    ALTER TABLE public.landing_events
      ADD CONSTRAINT landing_events_device_type_chk
      CHECK (device_type IS NULL OR device_type IN ('mobile', 'tablet', 'desktop')) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.landing_events VALIDATE CONSTRAINT landing_events_device_type_chk;

-- Lectura de la página Estadísticas (sitio, por fecha) y deduplicación por sesión.
CREATE INDEX IF NOT EXISTS landing_events_site_created_idx
  ON public.landing_events (created_at DESC)
  WHERE source_type = 'site';
CREATE INDEX IF NOT EXISTS landing_events_session_idx
  ON public.landing_events (session_id, event_name)
  WHERE session_id IS NOT NULL;

-- 2) Función de registro ------------------------------------------------------
-- Se reemplaza (no se sobrecarga): dos versiones con parámetros opcionales
-- harían ambigua la llamada de 11 parámetros en PostgREST.
DROP FUNCTION IF EXISTS public.log_landing_event(
  text, text, uuid, uuid, text, text, text, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.log_landing_event(
  _event_name text,
  _source_type text DEFAULT 'site',
  _source_id uuid DEFAULT NULL,
  _item_id uuid DEFAULT NULL,
  _lang text DEFAULT NULL,
  _path text DEFAULT NULL,
  _referrer text DEFAULT NULL,
  _user_agent text DEFAULT NULL,
  _utm_source text DEFAULT NULL,
  _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL,
  _session_id text DEFAULT NULL,
  _visitor_hash text DEFAULT NULL,
  _referrer_domain text DEFAULT NULL,
  _landing_path text DEFAULT NULL,
  _device_type text DEFAULT NULL,
  _has_gclid boolean DEFAULT NULL,
  _has_fbclid boolean DEFAULT NULL,
  _cta text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cid uuid;
  ua text := left(coalesce(_user_agent, ''), 500);
  pth text := left(coalesce(_path, ''), 500);
  lng text := left(_lang, 10);
  sid text := nullif(left(_session_id, 64), '');
  item uuid := CASE WHEN _source_type = 'multilink' THEN _item_id END;
BEGIN
  IF coalesce(_event_name, '') NOT IN (
    'page_view', 'link_click', 'whatsapp_click', 'contact_click', 'contact_submit'
  ) THEN
    RETURN;
  END IF;

  -- Segunda barrera contra bots (la primera está en el servidor de la app):
  -- la función sigue siendo invocable directo con la clave pública.
  IF ua = ''
     OR ua ~* '(bot|crawl|spider|slurp|headless|phantomjs|puppeteer|playwright|selenium|webdriver|lighthouse|pagespeed|facebookexternalhit|python-|curl/|wget|go-http-client|okhttp|axios/|node-fetch|undici|scrapy|prerender)'
  THEN
    RETURN;
  END IF;

  IF _source_type = 'landing' THEN
    SELECT l.client_id INTO cid FROM public.landing_pages l
      WHERE l.id = _source_id AND l.published = true;
    IF cid IS NULL THEN RETURN; END IF;
  ELSIF _source_type = 'multilink' THEN
    SELECT m.client_id INTO cid FROM public.multilinks m
      WHERE m.id = _source_id AND m.published = true;
    IF cid IS NULL THEN RETURN; END IF;
  ELSIF _source_type = 'site' THEN
    cid := NULL;
    _source_id := NULL;
  ELSE
    RETURN;
  END IF;

  -- Una visita por sesión y página: recargas y dobles montajes no suman.
  -- El lock serializa pedidos concurrentes de la misma sesión/página.
  IF _event_name = 'page_view' AND sid IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      sid || '|' || _source_type || '|' || coalesce(_source_id::text, '') || '|' || pth, 0
    ));
    IF EXISTS (
      SELECT 1 FROM public.landing_events e
      WHERE e.session_id = sid
        AND e.event_name = 'page_view'
        AND e.source_type = _source_type
        AND e.source_id IS NOT DISTINCT FROM _source_id
        AND e.path IS NOT DISTINCT FROM pth
    ) THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.landing_events (
    event_name, source_type, source_id, item_id, client_id,
    lang, path, referrer, user_agent, utm_source, utm_medium, utm_campaign,
    session_id, visitor_hash, referrer_domain, landing_path, device_type,
    has_gclid, has_fbclid, cta
  ) VALUES (
    _event_name, _source_type, _source_id, item, cid,
    lng, pth, left(coalesce(_referrer, ''), 500), ua,
    left(_utm_source, 120), left(_utm_medium, 120), left(_utm_campaign, 120),
    sid,
    CASE WHEN _visitor_hash ~ '^[0-9a-f]{64}$' THEN _visitor_hash END,
    left(lower(_referrer_domain), 120),
    left(_landing_path, 200),
    CASE WHEN _device_type IN ('mobile', 'tablet', 'desktop') THEN _device_type END,
    _has_gclid, _has_fbclid,
    left(_cta, 40)
  );

  -- Totales en caché; landing_events sigue siendo la fuente de verdad.
  IF _event_name = 'page_view' AND _source_type = 'landing' THEN
    UPDATE public.landing_pages SET view_count = view_count + 1 WHERE id = _source_id;
  ELSIF _event_name = 'page_view' AND _source_type = 'multilink' THEN
    UPDATE public.multilinks SET view_count = view_count + 1 WHERE id = _source_id;
  ELSIF _event_name = 'link_click' AND item IS NOT NULL THEN
    UPDATE public.multilink_items SET click_count = click_count + 1
      WHERE id = item AND multilink_id = _source_id AND is_active = true;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.log_landing_event(
  text, text, uuid, uuid, text, text, text, text, text, text, text,
  text, text, text, text, text, boolean, boolean, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_landing_event(
  text, text, uuid, uuid, text, text, text, text, text, text, text,
  text, text, text, text, text, boolean, boolean, text
) TO anon, authenticated;

-- 3) Lectura de eventos del sitio ----------------------------------------------
-- Antes cualquier usuario con sesión (incluidos clientes del portal) podía
-- leer los eventos del sitio. Ahora solo dueños/admins de una org (el equipo
-- de la agencia). No hay helper de "admin de plataforma" en la BD (se define
-- por variable de entorno), así que esta es la opción simple y segura;
-- las columnas nuevas solo guardan hashes diarios y dominios, nunca la IP.
DROP POLICY IF EXISTS "Authenticated read own site events" ON public.landing_events;
CREATE POLICY "Org managers read site events"
ON public.landing_events FOR SELECT TO authenticated
USING (
  source_type = 'site'
  AND EXISTS (SELECT 1 FROM public.user_orgs() o WHERE o.role IN ('owner', 'admin'))
);

NOTIFY pgrst, 'reload schema';
