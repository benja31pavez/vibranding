-- Client portal users can comment on their own client's deliverables
CREATE POLICY "client users comment own deliverables"
ON public.deliverable_comments FOR INSERT TO authenticated
WITH CHECK (
  client_id = public.user_client_id()
  AND author_role = 'client'
  AND EXISTS (SELECT 1 FROM public.deliverables d WHERE d.id = deliverable_id AND d.client_id = public.user_client_id())
);

-- ── Public (tokenized) review links ───────────────────────────────
CREATE OR REPLACE FUNCTION public.review_link_get(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE l record; d record; res jsonb;
BEGIN
  SELECT * INTO l FROM public.deliverable_review_links
   WHERE token = _token AND revoked = false AND expires_at > now();
  IF l IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;

  SELECT id, title, description, status, type, due_date, file_url, file_name, file_size, mime_type
    INTO d FROM public.deliverables WHERE id = l.deliverable_id;
  IF d IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'expires_at', l.expires_at,
    'deliverable', to_jsonb(d),
    'comments', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'kind', c.kind, 'body', c.body,
        'author_role', c.author_role, 'author_name', c.author_name,
        'created_at', c.created_at
      ) ORDER BY c.created_at)
      FROM public.deliverable_comments c WHERE c.deliverable_id = d.id
    ), '[]'::jsonb)
  ) INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.review_link_comment(_token text, _kind text, _body text, _name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE l record;
BEGIN
  IF _kind NOT IN ('comment', 'approval', 'change_request') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  END IF;
  IF coalesce(btrim(_body), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty');
  END IF;

  SELECT * INTO l FROM public.deliverable_review_links
   WHERE token = _token AND revoked = false AND expires_at > now();
  IF l IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;

  INSERT INTO public.deliverable_comments
    (deliverable_id, client_id, author, author_role, author_name, read_by_agency, kind, body)
  VALUES
    (l.deliverable_id, l.client_id, 'guest', 'guest',
     left(nullif(btrim(coalesce(_name, '')), ''), 120), false, _kind, left(btrim(_body), 4000));

  IF _kind = 'approval' THEN
    UPDATE public.deliverables SET status = 'done' WHERE id = l.deliverable_id;
  ELSIF _kind = 'change_request' THEN
    UPDATE public.deliverables SET status = 'in_progress' WHERE id = l.deliverable_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.review_link_get(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_link_comment(text, text, text, text) TO anon, authenticated;