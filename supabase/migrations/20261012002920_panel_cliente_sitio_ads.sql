-- =====================================================================
-- Panel del cliente (/mi) · Fase 2 — Sitio, Meta Ads y Google Ads (lectura)
-- =====================================================================
-- Tres RPC de solo lectura del panel del cliente. Todas:
--   * son SECURITY DEFINER con search_path fijo y fijan el cliente con
--     public.client_panel_target(_preview) (migración 20261012002900): el
--     usuario cliente SIEMPRE obtiene su user_client_id() (ignora _preview);
--     _preview solo vale para la agencia dueña (owns_client), y la server
--     function además exige getClientOrgRole antes de pasarlo;
--   * devuelven agregados calculados en el servidor (nunca filas de
--     landing_events, ad_insights_daily ni google_ads_insights_daily);
--   * no devuelven ids de cuentas (ad_account_id, customer_id, MCC), tokens,
--     errores de sincronización, alertas internas ni campos de configuración;
--   * devuelven NULL a quien no tiene cliente legible (agencia sin _preview,
--     extraños, _preview de un cliente ajeno);
--   * no son ejecutables por anon/PUBLIC (solo authenticated y service_role).
--
-- 1. client_site_summary(_days, _preview)
--      { multilink: {slug, custom_domain, title} | null,
--        landing:   {slug, title} | null,
--        multilink_metrics: {views, clicks, whatsapp_clicks},
--        landing_metrics:   {views, clicks, contacts},
--        days }
--    Solo páginas PUBLICADAS (lo que el cliente ve "tal como se publica"); un
--    borrador aparece como {published:false} sin slug. Si hubiera varias
--    (hoy hay como máximo una por cliente, sin restricción única), se elige
--    la publicada actualizada más recientemente (desempate por id).
--    custom_domain solo si está verificado. Métricas de ESA página, con la
--    misma definición que Estadísticas de la agencia:
--      multienlace: clics = link_click + whatsapp_click (MultilinkAnalytics);
--      landing: clics = contact_click + whatsapp_click, contacts = contact_submit.
--    Excluyen bots con el criterio de src/lib/analytics/bots.ts.
--
-- 2. client_meta_ads_summary(_days, _preview)
--      { connected, last_synced_at, currency, billing_state, billing_reason,
--        totals: {spend, impressions, reach, clicks, results, cost_per_result},
--        campaigns: [{name, status, spend, impressions, reach, clicks,
--                     results, cost_per_result}] (máx. 20, por gasto),
--        days }
--    results = conversaciones iniciadas (messaging_conversations_started).
--    reach = suma diaria por anuncio (una persona puede repetirse).
--    status: 'activa' | 'pausada' | 'finalizada' (estado en Meta guardado por
--    la plataforma) o 'sin_dato' cuando la campaña solo existe en métricas.
--    Los borradores internos (DRAFT, sin fb_campaign_id) nunca se listan.
--
-- 3. client_google_ads_summary(_days, _preview)
--      { connected, last_synced_at, billing_state,
--        totals: {spend, impressions, clicks, results, cost_per_result},
--        campaigns: [{name, status, spend, impressions, clicks, results,
--                     cost_per_result}] (máx. 20), days }
--    results = conversiones. status: 'activa' si tuvo impresiones en los
--    últimos 3 días, si no 'sin_entrega' (la ingesta no guarda el estado).
--
--    billing_state (ambas): 'verificado' | 'pendiente' | 'rechazado' |
--    'sin_cuenta', con la misma regla que src/lib/ads-billing/combined.ts
--    (metaVerification / googleVerification, Google vigente 72 h). En Meta,
--    meta_billing_status.ad_account_id guarda solo dígitos y
--    meta_accounts.ad_account_id puede traer "act_": se compara sin prefijo.
--    meta_accounts y google_ads_accounts son UNIQUE(client_id): una cuenta.
--
-- _days se acota a 1..90 (el panel ofrece 7/30/90); el período termina hoy
-- (hora de Chile).
-- No se abren policies nuevas ni se toca ninguna tabla. Re-ejecutable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Bots (espejo de src/lib/analytics/bots.ts). IMMUTABLE, sin search_path
-- (no toca tablas) para que el planner la pueda inlinear; interna.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.analytics_is_bot_ua(_ua text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT length(btrim(coalesce(_ua, ''))) < 10
      OR _ua ~* (
        'bot\y|bot/|crawl|spider|slurp|bingpreview|facebookexternalhit|facebot|embedly|'
        'quora link preview|pinterest/|vkshare|w3c_validator|whatsapp/|skypeuripreview|'
        'yandex|baiduspider|semrush|ahrefs|bytespider|gptbot|chatgpt-user|oai-searchbot|'
        'claude-web|anthropic-ai|perplexity|ccbot|google-inspectiontool|googleother|'
        'mediapartners-google|adsbot|feedfetcher|lighthouse|pagespeed|gtmetrix|pingdom|'
        'uptimerobot|statuscake|site24x7|headless|phantomjs|puppeteer|playwright|'
        'selenium|webdriver|cypress|python-|aiohttp|httpx|go-http-client|okhttp|java/|'
        'libwww|wget|curl/|node-fetch|axios/|undici|scrapy|httpclient|postmanruntime|'
        'insomnia|cloudflare-workers|prerender|rendertron'
      );
$$;

REVOKE ALL ON FUNCTION public.analytics_is_bot_ua(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_is_bot_ua(text) TO service_role;

-- ---------------------------------------------------------------------
-- 1) Sitio
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.client_site_summary(integer);
CREATE OR REPLACE FUNCTION public.client_site_summary(
  _days integer DEFAULT 30,
  _preview uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _client uuid := public.client_panel_target(_preview);
  _n integer := least(greatest(coalesce(_days, 30), 1), 90);
  _since timestamptz;
  _ml record;
  _lp record;
  _mlm jsonb := jsonb_build_object('views', 0, 'clicks', 0, 'whatsapp_clicks', 0);
  _lpm jsonb := jsonb_build_object('views', 0, 'clicks', 0, 'contacts', 0);
BEGIN
  IF _client IS NULL THEN
    RETURN NULL;
  END IF;
  -- Inicio del primer día del período, en hora de Chile.
  _since := (((now() AT TIME ZONE 'America/Santiago')::date - (_n - 1))::timestamp)
            AT TIME ZONE 'America/Santiago';

  SELECT m.id, m.slug, m.title, m.published,
         CASE WHEN m.custom_domain_verified THEN m.custom_domain END AS custom_domain
    INTO _ml
    FROM public.multilinks m
   WHERE m.client_id = _client
   ORDER BY m.published DESC, m.updated_at DESC, m.id
   LIMIT 1;

  SELECT l.id, l.slug, l.hero_title, l.published
    INTO _lp
    FROM public.landing_pages l
   WHERE l.client_id = _client
   ORDER BY l.published DESC, l.updated_at DESC, l.id
   LIMIT 1;

  IF _ml.id IS NOT NULL THEN
    SELECT jsonb_build_object(
             'views', count(*) FILTER (WHERE e.event_name = 'page_view'),
             'clicks', count(*) FILTER (WHERE e.event_name IN ('link_click', 'whatsapp_click')),
             'whatsapp_clicks', count(*) FILTER (WHERE e.event_name = 'whatsapp_click'))
      INTO _mlm
      FROM public.landing_events e
     WHERE e.client_id = _client
       AND e.source_type = 'multilink'
       AND e.source_id = _ml.id
       AND e.created_at >= _since
       -- Primero el filtro por evento (índice/columna) y recién después el regex.
       AND e.event_name IN ('page_view', 'link_click', 'whatsapp_click')
       AND NOT public.analytics_is_bot_ua(e.user_agent);
  END IF;

  IF _lp.id IS NOT NULL THEN
    SELECT jsonb_build_object(
             'views', count(*) FILTER (WHERE e.event_name = 'page_view'),
             'clicks', count(*) FILTER (WHERE e.event_name IN ('contact_click', 'whatsapp_click')),
             'contacts', count(*) FILTER (WHERE e.event_name = 'contact_submit'))
      INTO _lpm
      FROM public.landing_events e
     WHERE e.client_id = _client
       AND e.source_type = 'landing'
       AND e.source_id = _lp.id
       AND e.created_at >= _since
       AND e.event_name IN ('page_view', 'contact_click', 'whatsapp_click', 'contact_submit')
       AND NOT public.analytics_is_bot_ua(e.user_agent);
  END IF;

  RETURN jsonb_build_object(
    'days', _n,
    'multilink', CASE
      WHEN _ml.id IS NULL THEN NULL
      WHEN NOT _ml.published THEN jsonb_build_object('published', false)
      ELSE jsonb_build_object('published', true, 'slug', _ml.slug, 'title', _ml.title,
                              'custom_domain', _ml.custom_domain)
    END,
    'landing', CASE
      WHEN _lp.id IS NULL THEN NULL
      WHEN NOT _lp.published THEN jsonb_build_object('published', false)
      ELSE jsonb_build_object('published', true, 'slug', _lp.slug, 'title', _lp.hero_title)
    END,
    'multilink_metrics', _mlm,
    'landing_metrics', _lpm
  );
END;
$$;

COMMENT ON FUNCTION public.client_site_summary(integer, uuid) IS
  'Panel del cliente: multienlace y landing publicados del cliente de la sesión (user_client_id) y visitas/clics agregados sin bots.';

REVOKE ALL ON FUNCTION public.client_site_summary(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_site_summary(integer, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2) Meta Ads
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.client_meta_ads_summary(integer);
CREATE OR REPLACE FUNCTION public.client_meta_ads_summary(
  _days integer DEFAULT 30,
  _preview uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _client uuid := public.client_panel_target(_preview);
  _n integer := least(greatest(coalesce(_days, 30), 1), 90);
  _today date := (now() AT TIME ZONE 'America/Santiago')::date;
  _since date;
  _acc record;
  _bill record;
  _state text;
  _reason text;
  _totals jsonb;
  _campaigns jsonb;
BEGIN
  IF _client IS NULL THEN
    RETURN NULL;
  END IF;
  _since := _today - (_n - 1);

  SELECT a.connected, a.ad_account_id, a.currency, a.last_ingest_at, a.last_synced_at
    INTO _acc
    FROM public.meta_accounts a
   WHERE a.client_id = _client;

  IF NOT coalesce(_acc.connected, false) OR _acc.ad_account_id IS NULL THEN
    RETURN jsonb_build_object('connected', false, 'days', _n);
  END IF;

  -- Pago de pauta: último chequeo de la cuenta enlazada (misma regla que metaVerification).
  SELECT b.account_status, b.has_funding
    INTO _bill
    FROM public.meta_billing_status b
   WHERE b.client_id = _client
     -- meta_billing_status guarda solo dígitos; meta_accounts puede traer "act_".
     AND b.ad_account_id = regexp_replace(_acc.ad_account_id, '^act_', '')
   ORDER BY b.checked_at DESC NULLS LAST
   LIMIT 1;

  _reason := CASE
    WHEN _bill IS NULL OR _bill.account_status IS NULL AND _bill.has_funding IS NULL THEN NULL
    WHEN _bill.account_status = 1 AND _bill.has_funding IS TRUE THEN 'ok'
    WHEN _bill.account_status = 1 AND _bill.has_funding IS FALSE THEN 'no_funding'
    WHEN _bill.account_status = 1 THEN 'funding_unknown'
    WHEN _bill.account_status = 2 THEN 'disabled'
    WHEN _bill.account_status = 3 THEN 'unsettled'
    WHEN _bill.account_status = 7 THEN 'pending_review'
    WHEN _bill.account_status = 8 THEN 'pending_settlement'
    WHEN _bill.account_status = 9 THEN 'grace_period'
    WHEN _bill.account_status IN (100, 101) THEN 'closed'
    ELSE 'unknown_status'
  END;
  _state := CASE
    WHEN _reason = 'ok' THEN 'verificado'
    WHEN _reason IS NULL OR _reason = 'funding_unknown' THEN 'pendiente'
    ELSE 'rechazado'
  END;

  WITH per_campaign AS (
    SELECT i.campaign_id,
           (array_agg(i.campaign_name ORDER BY i.date DESC)
              FILTER (WHERE nullif(btrim(i.campaign_name), '') IS NOT NULL))[1] AS name,
           sum(coalesce(i.spend, 0)) AS spend,
           sum(coalesce(i.impressions, 0)) AS impressions,
           sum(coalesce(i.reach, 0)) AS reach,
           sum(coalesce(i.clicks, 0)) AS clicks,
           sum(coalesce(i.messaging_conversations_started, 0)) AS results
      FROM public.ad_insights_daily i
     WHERE i.client_id = _client
       AND i.level = 'ad'
       AND i.campaign_id IS NOT NULL
       AND i.date BETWEEN _since AND _today
     GROUP BY i.campaign_id
  ),
  known AS (
    SELECT c.fb_campaign_id, c.name, c.status::text AS status
      FROM public.meta_ads_campaigns c
     WHERE c.client_id = _client
       AND c.fb_campaign_id IS NOT NULL
       AND c.status::text IN ('ACTIVE', 'PAUSED', 'ARCHIVED', 'DELETED')
  ),
  merged AS (
    SELECT coalesce(p.name, k.name, 'Campaña sin nombre') AS name,
           CASE k.status
             WHEN 'ACTIVE' THEN 'activa'
             WHEN 'PAUSED' THEN 'pausada'
             WHEN 'ARCHIVED' THEN 'finalizada'
             WHEN 'DELETED' THEN 'finalizada'
             ELSE 'sin_dato'
           END AS status,
           coalesce(p.spend, 0) AS spend,
           coalesce(p.impressions, 0) AS impressions,
           coalesce(p.reach, 0) AS reach,
           coalesce(p.clicks, 0) AS clicks,
           coalesce(p.results, 0) AS results
      FROM per_campaign p
      FULL JOIN known k ON k.fb_campaign_id = p.campaign_id
     -- Campañas sin métricas en el período: solo las vigentes (activas/pausadas).
     WHERE p.campaign_id IS NOT NULL OR k.status IN ('ACTIVE', 'PAUSED')
  )
  SELECT
    jsonb_build_object(
      'spend', round(coalesce(sum(spend), 0)),
      'impressions', coalesce(sum(impressions), 0),
      'reach', coalesce(sum(reach), 0),
      'clicks', coalesce(sum(clicks), 0),
      'results', coalesce(sum(results), 0),
      'cost_per_result', CASE WHEN sum(results) > 0 THEN round(sum(spend) / sum(results)) END),
    coalesce(
      (SELECT jsonb_agg(jsonb_build_object(
                'name', m2.name, 'status', m2.status, 'spend', round(m2.spend),
                'impressions', m2.impressions, 'reach', m2.reach, 'clicks', m2.clicks,
                'results', m2.results,
                'cost_per_result', CASE WHEN m2.results > 0 THEN round(m2.spend / m2.results) END)
              ORDER BY m2.spend DESC, m2.name)
         FROM (SELECT * FROM merged ORDER BY spend DESC, name LIMIT 20) m2),
      '[]'::jsonb)
    INTO _totals, _campaigns
    FROM merged;

  RETURN jsonb_build_object(
    'connected', true,
    'days', _n,
    'currency', coalesce(_acc.currency, 'CLP'),
    'last_synced_at', coalesce(_acc.last_ingest_at, _acc.last_synced_at),
    'billing_state', _state,
    'billing_reason', _reason,
    'totals', _totals,
    'campaigns', _campaigns
  );
END;
$$;

COMMENT ON FUNCTION public.client_meta_ads_summary(integer, uuid) IS
  'Panel del cliente: resumen de Meta Ads (agregados por campaña y totales del período) y estado del pago de pauta, sin ids de cuenta ni tokens.';

REVOKE ALL ON FUNCTION public.client_meta_ads_summary(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_meta_ads_summary(integer, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3) Google Ads
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.client_google_ads_summary(integer);
CREATE OR REPLACE FUNCTION public.client_google_ads_summary(
  _days integer DEFAULT 30,
  _preview uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _client uuid := public.client_panel_target(_preview);
  _n integer := least(greatest(coalesce(_days, 30), 1), 90);
  _today date := (now() AT TIME ZONE 'America/Santiago')::date;
  _since date;
  _acc record;
  _bill record;
  _state text;
  _totals jsonb;
  _campaigns jsonb;
BEGIN
  IF _client IS NULL THEN
    RETURN NULL;
  END IF;
  _since := _today - (_n - 1);

  SELECT a.customer_id, a.status, a.last_synced_at
    INTO _acc
    FROM public.google_ads_accounts a
   WHERE a.client_id = _client;

  IF _acc.status IS DISTINCT FROM 'conectada' OR _acc.customer_id IS NULL THEN
    RETURN jsonb_build_object('connected', false, 'days', _n);
  END IF;

  -- Misma regla que googleVerification: rechazado manda; verificado solo con
  -- facturación válida y un chequeo exitoso de las últimas 72 h.
  SELECT b.verdict, b.has_valid_billing, b.last_success_at
    INTO _bill
    FROM public.google_ads_billing_status b
   WHERE b.client_id = _client
     AND b.customer_id = _acc.customer_id;

  _state := CASE
    WHEN _bill.verdict = 'rechazado' THEN 'rechazado'
    WHEN _bill.verdict = 'verificado' AND _bill.has_valid_billing IS TRUE
         AND _bill.last_success_at BETWEEN now() - interval '72 hours' AND now() THEN 'verificado'
    ELSE 'pendiente'
  END;

  WITH per_campaign AS (
    SELECT i.campaign_id,
           (array_agg(i.campaign_name ORDER BY i.date DESC)
              FILTER (WHERE nullif(btrim(i.campaign_name), '') IS NOT NULL))[1] AS name,
           sum(coalesce(i.cost_clp, 0)) AS spend,
           sum(coalesce(i.impressions, 0)) AS impressions,
           sum(coalesce(i.clicks, 0)) AS clicks,
           sum(coalesce(i.conversions, 0)) AS results,
           bool_or(i.date >= _today - 2 AND coalesce(i.impressions, 0) > 0) AS recent
      FROM public.google_ads_insights_daily i
     WHERE i.client_id = _client
       AND i.customer_id = _acc.customer_id
       AND i.date BETWEEN _since AND _today
     GROUP BY i.campaign_id
  )
  SELECT
    jsonb_build_object(
      'spend', round(coalesce(sum(spend), 0)),
      'impressions', coalesce(sum(impressions), 0),
      'clicks', coalesce(sum(clicks), 0),
      'results', round(coalesce(sum(results), 0), 2),
      'cost_per_result', CASE WHEN sum(results) > 0 THEN round(sum(spend) / sum(results)) END),
    coalesce(
      (SELECT jsonb_agg(jsonb_build_object(
                'name', coalesce(p2.name, 'Campaña sin nombre'),
                'status', CASE WHEN p2.recent THEN 'activa' ELSE 'sin_entrega' END,
                'spend', round(p2.spend), 'impressions', p2.impressions, 'clicks', p2.clicks,
                'results', round(p2.results, 2),
                'cost_per_result', CASE WHEN p2.results > 0 THEN round(p2.spend / p2.results) END)
              ORDER BY p2.spend DESC, p2.name)
         FROM (SELECT * FROM per_campaign ORDER BY spend DESC, name LIMIT 20) p2),
      '[]'::jsonb)
    INTO _totals, _campaigns
    FROM per_campaign;

  RETURN jsonb_build_object(
    'connected', true,
    'days', _n,
    'currency', 'CLP',
    'last_synced_at', _acc.last_synced_at,
    'billing_state', _state,
    'totals', _totals,
    'campaigns', _campaigns
  );
END;
$$;

COMMENT ON FUNCTION public.client_google_ads_summary(integer, uuid) IS
  'Panel del cliente: resumen de Google Ads (agregados por campaña y totales del período) y estado del pago de pauta, sin customer_id, MCC ni tokens.';

REVOKE ALL ON FUNCTION public.client_google_ads_summary(integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_google_ads_summary(integer, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
