CREATE OR REPLACE FUNCTION public.client_analytics(_client_id uuid, _from date, _to date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  span int := GREATEST((_to - _from) + 1, 1);
  pfrom date := _from - span;
  pto date := _from - 1;
  result jsonb;
BEGIN
  WITH conv AS (
    SELECT c.id,
           min(m.timestamp) FILTER (WHERE m.direction = 'inbound') AS first_in
    FROM public.whatsapp_conversations c
    JOIN public.whatsapp_messages m ON m.conversation_id = c.id
    WHERE c.client_id = _client_id
    GROUP BY c.id
  ),
  conv2 AS (
    SELECT v.id,
           v.first_in,
           (SELECT min(m2.timestamp) FROM public.whatsapp_messages m2
             WHERE m2.conversation_id = v.id
               AND m2.direction = 'outbound'
               AND m2.timestamp >= v.first_in) AS first_out
    FROM conv v
    WHERE v.first_in IS NOT NULL
  ),
  cur AS (SELECT * FROM conv2 WHERE first_in::date BETWEEN _from AND _to),
  prev AS (SELECT * FROM conv2 WHERE first_in::date BETWEEN pfrom AND pto),
  oc AS (SELECT * FROM public.conversation_outcomes WHERE client_id = _client_id),
  ins_cur AS (
    SELECT coalesce(sum(spend), 0) AS spend,
           coalesce(sum(messaging_conversations_started), 0) AS mcs
    FROM public.ad_insights_daily
    WHERE client_id = _client_id AND date BETWEEN _from AND _to
  ),
  ins_prev AS (
    SELECT coalesce(sum(spend), 0) AS spend,
           coalesce(sum(messaging_conversations_started), 0) AS mcs
    FROM public.ad_insights_daily
    WHERE client_id = _client_id AND date BETWEEN pfrom AND pto
  ),
  f_cur AS (
    SELECT count(*) AS started,
           count(o.conversation_id) FILTER (WHERE o.status IN ('answered', 'qualified', 'closed')) AS answered,
           count(o.conversation_id) FILTER (WHERE o.status IN ('qualified', 'closed')) AS qualified,
           count(o.conversation_id) FILTER (WHERE o.status = 'closed') AS closed,
           count(o.conversation_id) AS marked,
           coalesce(sum(o.value_clp) FILTER (WHERE o.status = 'closed'), 0) AS value_clp,
           count(*) FILTER (WHERE o.status = 'closed' AND o.value_clp IS NOT NULL) AS closed_with_value
    FROM cur LEFT JOIN oc o ON o.conversation_id = cur.id
  ),
  f_prev AS (
    SELECT count(*) AS started,
           count(o.conversation_id) FILTER (WHERE o.status IN ('qualified', 'closed')) AS qualified,
           count(o.conversation_id) FILTER (WHERE o.status = 'closed') AS closed,
           count(o.conversation_id) AS marked,
           coalesce(sum(o.value_clp) FILTER (WHERE o.status = 'closed'), 0) AS value_clp
    FROM prev LEFT JOIN oc o ON o.conversation_id = prev.id
  ),
  rt_cur AS (
    SELECT percentile_cont(0.5) WITHIN GROUP (
             ORDER BY extract(epoch FROM (first_out - first_in))
           ) AS median_seconds,
           count(*) AS sample
    FROM cur WHERE first_out IS NOT NULL
  ),
  rt_prev AS (
    SELECT percentile_cont(0.5) WITHIN GROUP (
             ORDER BY extract(epoch FROM (first_out - first_in))
           ) AS median_seconds
    FROM prev WHERE first_out IS NOT NULL
  ),
  heat AS (
    SELECT extract(isodow FROM first_in)::int AS dow,
           extract(hour FROM first_in)::int AS hour,
           percentile_cont(0.5) WITHIN GROUP (
             ORDER BY extract(epoch FROM (first_out - first_in))
           ) AS median_seconds,
           count(*) AS sample
    FROM cur WHERE first_out IS NOT NULL
    GROUP BY 1, 2
  ),
  camp AS (
    SELECT campaign_id,
           max(campaign_name) AS campaign_name,
           sum(spend) AS spend,
           sum(messaging_conversations_started) AS conversations_started
    FROM public.ad_insights_daily
    WHERE client_id = _client_id AND date BETWEEN _from AND _to AND campaign_id IS NOT NULL
    GROUP BY campaign_id
  ),
  ad_camp AS (
    SELECT DISTINCT ad_id, campaign_id
    FROM public.ad_insights_daily
    WHERE client_id = _client_id AND ad_id IS NOT NULL AND campaign_id IS NOT NULL
  ),
  attr AS (
    SELECT a.conversation_id, ac.campaign_id
    FROM public.attributions a
    JOIN ad_camp ac ON ac.ad_id = a.ad_id
    WHERE a.client_id = _client_id AND a.conversation_id IS NOT NULL
  ),
  camp_out AS (
    SELECT attr.campaign_id,
           count(*) AS attributed,
           count(o.conversation_id) FILTER (WHERE o.status IN ('qualified', 'closed')) AS qualified,
           count(o.conversation_id) FILTER (WHERE o.status = 'closed') AS closed,
           coalesce(sum(o.value_clp) FILTER (WHERE o.status = 'closed'), 0) AS value_clp,
           count(o.conversation_id) AS marked
    FROM attr
    JOIN cur ON cur.id = attr.conversation_id
    LEFT JOIN oc o ON o.conversation_id = attr.conversation_id
    GROUP BY attr.campaign_id
  ),
  posts AS (
    SELECT post_id,
           max(permalink) AS permalink,
           max(media_type) AS media_type,
           max(reach) AS reach,
           max(engagement) AS engagement,
           max(saves) AS saves
    FROM public.post_insights_daily
    WHERE client_id = _client_id AND date BETWEEN _from AND _to
    GROUP BY post_id
    ORDER BY max(engagement) DESC
    LIMIT 12
  )
  SELECT jsonb_build_object(
    'range', jsonb_build_object('from', _from, 'to', _to, 'days', span,
                                'prev_from', pfrom, 'prev_to', pto),
    'funnel', (SELECT to_jsonb(f_cur) FROM f_cur),
    'funnel_prev', (SELECT to_jsonb(f_prev) FROM f_prev),
    'spend', (SELECT spend FROM ins_cur),
    'spend_prev', (SELECT spend FROM ins_prev),
    'meta_conversations_started', (SELECT mcs FROM ins_cur),
    'has_spend_data', (SELECT EXISTS(SELECT 1 FROM public.ad_insights_daily
                        WHERE client_id = _client_id AND date BETWEEN _from AND _to)),
    'response_time', (SELECT to_jsonb(rt_cur) FROM rt_cur),
    'response_time_prev', (SELECT to_jsonb(rt_prev) FROM rt_prev),
    'heatmap', (SELECT coalesce(jsonb_agg(to_jsonb(heat)), '[]'::jsonb) FROM heat),
    'campaigns', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'campaign_id', c.campaign_id,
        'campaign_name', c.campaign_name,
        'spend', c.spend,
        'conversations_started', c.conversations_started,
        'attributed', coalesce(co.attributed, 0),
        'marked', coalesce(co.marked, 0),
        'qualified', coalesce(co.qualified, 0),
        'closed', coalesce(co.closed, 0),
        'value_clp', coalesce(co.value_clp, 0)
      ) ORDER BY c.spend DESC), '[]'::jsonb)
      FROM camp c LEFT JOIN camp_out co ON co.campaign_id = c.campaign_id
    ),
    'posts', (SELECT coalesce(jsonb_agg(to_jsonb(posts)), '[]'::jsonb) FROM posts)
  ) INTO result;

  RETURN result;
END $$;

-- SECURITY INVOKER (default): the caller's RLS policies decide what is visible.
GRANT EXECUTE ON FUNCTION public.client_analytics(uuid, date, date) TO authenticated, service_role;