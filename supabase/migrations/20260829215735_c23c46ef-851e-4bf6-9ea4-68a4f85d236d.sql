-- 1) Attribution columns on landing_events -------------------------------
ALTER TABLE public.landing_events
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id uuid,
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text;

-- Backfill from the recorded path: /@slug -> landing, /@slug/links -> multilink
UPDATE public.landing_events e
SET source_type = 'multilink', source_id = m.id, client_id = m.client_id
FROM public.multilinks m
WHERE e.source_type IS NULL
  AND e.path ~ '^/@[^/?#]+/links'
  AND m.slug = substring(e.path from '^/@([^/?#]+)');

UPDATE public.landing_events e
SET source_type = 'landing', source_id = l.id, client_id = l.client_id
FROM public.landing_pages l
WHERE e.source_type IS NULL
  AND e.path ~ '^/@[^/?#]+'
  AND l.slug = substring(e.path from '^/@([^/?#]+)');

-- The agency's own marketing site: attributable to the site, not to a client.
UPDATE public.landing_events
SET source_type = 'site'
WHERE source_type IS NULL AND (path IS NULL OR path !~ '^/@');

-- Anything left pointed at a slug that no longer resolves: unattributable.
DELETE FROM public.landing_events WHERE source_type IS NULL;

ALTER TABLE public.landing_events
  ALTER COLUMN source_type SET NOT NULL,
  ADD CONSTRAINT landing_events_source_type_chk
    CHECK (source_type IN ('landing', 'multilink', 'site'));

CREATE INDEX IF NOT EXISTS landing_events_client_created_idx
  ON public.landing_events (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS landing_events_source_created_idx
  ON public.landing_events (source_type, source_id, created_at DESC);

-- 2) Single insert path: the visitor cannot forge client_id ---------------
DROP POLICY IF EXISTS "Anyone can insert landing events" ON public.landing_events;
REVOKE INSERT ON public.landing_events FROM anon, authenticated;

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
  _utm_campaign text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cid uuid;
BEGIN
  IF _event_name NOT IN (
    'page_view', 'link_click', 'whatsapp_click', 'contact_click', 'contact_submit'
  ) THEN
    RETURN;
  END IF;

  IF _source_type = 'landing' THEN
    SELECT client_id INTO cid FROM public.landing_pages
      WHERE id = _source_id AND published = true;
    IF cid IS NULL THEN RETURN; END IF;
  ELSIF _source_type = 'multilink' THEN
    SELECT client_id INTO cid FROM public.multilinks
      WHERE id = _source_id AND published = true;
    IF cid IS NULL THEN RETURN; END IF;
  ELSIF _source_type = 'site' THEN
    cid := NULL;
    _source_id := NULL;
    _item_id := NULL;
  ELSE
    RETURN;
  END IF;

  INSERT INTO public.landing_events (
    event_name, source_type, source_id, item_id, client_id,
    lang, path, referrer, user_agent, utm_source, utm_medium, utm_campaign
  ) VALUES (
    _event_name, _source_type, _source_id, _item_id, cid,
    _lang, left(coalesce(_path, ''), 500), left(coalesce(_referrer, ''), 500),
    left(coalesce(_user_agent, ''), 500),
    left(_utm_source, 120), left(_utm_medium, 120), left(_utm_campaign, 120)
  );

  -- Cached totals only; landing_events stays the source of truth.
  IF _event_name = 'page_view' AND _source_type = 'landing' THEN
    UPDATE public.landing_pages SET view_count = view_count + 1 WHERE id = _source_id;
  ELSIF _event_name = 'page_view' AND _source_type = 'multilink' THEN
    UPDATE public.multilinks SET view_count = view_count + 1 WHERE id = _source_id;
  ELSIF _event_name = 'link_click' AND _item_id IS NOT NULL THEN
    UPDATE public.multilink_items SET click_count = click_count + 1
      WHERE id = _item_id AND multilink_id = _source_id AND is_active = true;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.log_landing_event(text, text, uuid, uuid, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_landing_event(text, text, uuid, uuid, text, text, text, text, text, text, text) TO anon, authenticated;

-- 3) Read access to the event stream -------------------------------------
DROP POLICY IF EXISTS "Org members read their client events" ON public.landing_events;
CREATE POLICY "Org members read their client events"
ON public.landing_events FOR SELECT TO authenticated
USING (client_id IS NOT NULL AND public.owns_client(client_id));

DROP POLICY IF EXISTS "Authenticated read own site events" ON public.landing_events;
CREATE POLICY "Authenticated read own site events"
ON public.landing_events FOR SELECT TO authenticated
USING (source_type = 'site');

GRANT SELECT ON public.landing_events TO authenticated;

-- 4) WhatsApp CTA block on the landing page ------------------------------
ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS whatsapp_cta_text text,
  ADD COLUMN IF NOT EXISTS whatsapp_message text;

-- 5) Contact form gains a phone field ------------------------------------
ALTER TABLE public.landing_contact_submissions
  ADD COLUMN IF NOT EXISTS phone text;

-- 6) Trace an inbound conversation back to the page that produced it -----
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS lead_source_type text,
  ADD COLUMN IF NOT EXISTS lead_source_id uuid,
  ADD COLUMN IF NOT EXISTS lead_source_detail text;