CREATE OR REPLACE FUNCTION public.content_performance(_client_id uuid, _from date, _to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  tz text;
  followers int;
  result jsonb;
BEGIN
  IF NOT public.client_analytics_guard(_client_id) THEN
    RAISE EXCEPTION 'not authorized for this client';
  END IF;

  SELECT coalesce(timezone_name, 'UTC') INTO tz
  FROM public.meta_accounts WHERE client_id = _client_id LIMIT 1;
  tz := coalesce(tz, 'UTC');

  SELECT current_followers INTO followers
  FROM public.instagram_profiles WHERE client_id = _client_id LIMIT 1;

  WITH latest AS (
    SELECT DISTINCT ON (post_id)
      post_id, date, reach, engagement, saves, permalink, media_type
    FROM public.post_insights_daily
    WHERE client_id = _client_id AND date BETWEEN _from AND _to
    ORDER BY post_id, date DESC
  ),
  joined AS (
    SELECT l.post_id, l.date, l.reach, l.engagement, l.saves, l.permalink, l.media_type,
           p.id AS ig_post_id,
           coalesce(p.format::text, lower(coalesce(l.media_type, ''))) AS format,
           nullif(btrim(coalesce(p.objective, '')), '') AS objective,
           p.caption,
           coalesce(p.cover_url, p.image_url, p.carousel_urls[1]) AS thumb,
           coalesce(p.published_at, p.scheduled_at) AS at
    FROM latest l
    LEFT JOIN public.instagram_posts p
      ON p.client_id = _client_id AND p.ig_media_id = l.post_id
  ),
  by_hour AS (
    SELECT extract(hour FROM (at AT TIME ZONE tz))::int AS hour,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY engagement) AS median_engagement,
           count(*) AS sample
    FROM joined WHERE at IS NOT NULL
    GROUP BY 1 ORDER BY 1
  ),
  by_dow AS (
    SELECT extract(isodow FROM (at AT TIME ZONE tz))::int AS dow,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY engagement) AS median_engagement,
           count(*) AS sample
    FROM joined WHERE at IS NOT NULL
    GROUP BY 1 ORDER BY 1
  ),
  by_format AS (
    SELECT nullif(format, '') AS format,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY engagement) AS median_engagement,
           round(avg(engagement)::numeric, 1) AS avg_engagement,
           round(avg(reach)::numeric, 1) AS avg_reach,
           round(avg(saves)::numeric, 1) AS avg_saves,
           count(*) AS sample
    FROM joined WHERE nullif(format, '') IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC
  ),
  by_objective AS (
    SELECT objective,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY engagement) AS median_engagement,
           round(avg(engagement)::numeric, 1) AS avg_engagement,
           round(avg(reach)::numeric, 1) AS avg_reach,
           count(*) AS sample
    FROM joined WHERE objective IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC
  ),
  ranked AS (
    SELECT post_id, permalink, thumb, caption, format, objective,
           reach, engagement, saves, at,
           row_number() OVER (ORDER BY engagement DESC) AS rn_desc,
           row_number() OVER (ORDER BY engagement ASC) AS rn_asc
    FROM joined
  ),
  series AS (
    SELECT date,
           sum(engagement) AS engagement,
           sum(reach) AS reach,
           count(*) AS posts
    FROM public.post_insights_daily
    WHERE client_id = _client_id AND date BETWEEN _from AND _to
    GROUP BY 1 ORDER BY 1
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', _from, 'to', _to),
    'timezone', tz,
    'followers', followers,
    'has_meta_account', (SELECT EXISTS(SELECT 1 FROM public.meta_accounts WHERE client_id = _client_id AND connected = true)),
    'synced_media_count', (SELECT count(*) FROM public.instagram_posts WHERE client_id = _client_id AND ig_media_id IS NOT NULL),
    'insight_post_count', (SELECT count(*) FROM joined),
    'matched_post_count', (SELECT count(*) FROM joined WHERE ig_post_id IS NOT NULL),
    'objective_post_count', (SELECT count(*) FROM joined WHERE objective IS NOT NULL),
    'by_hour', (SELECT coalesce(jsonb_agg(to_jsonb(by_hour)), '[]'::jsonb) FROM by_hour),
    'by_dow', (SELECT coalesce(jsonb_agg(to_jsonb(by_dow)), '[]'::jsonb) FROM by_dow),
    'by_format', (SELECT coalesce(jsonb_agg(to_jsonb(by_format)), '[]'::jsonb) FROM by_format),
    'by_objective', (SELECT coalesce(jsonb_agg(to_jsonb(by_objective)), '[]'::jsonb) FROM by_objective),
    'top', (SELECT coalesce(jsonb_agg(to_jsonb(r) - 'rn_desc' - 'rn_asc' ORDER BY r.rn_desc), '[]'::jsonb) FROM ranked r WHERE r.rn_desc <= 5),
    'bottom', (SELECT coalesce(jsonb_agg(to_jsonb(r) - 'rn_desc' - 'rn_asc' ORDER BY r.rn_asc), '[]'::jsonb) FROM ranked r WHERE r.rn_asc <= 5),
    'series', (SELECT coalesce(jsonb_agg(to_jsonb(series)), '[]'::jsonb) FROM series)
  ) INTO result;

  RETURN result;
END $function$;

REVOKE ALL ON FUNCTION public.content_performance(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.content_performance(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.content_performance(uuid, date, date) TO service_role;