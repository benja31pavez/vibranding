-- =====================================================================
-- Fase 0 · 1/5 — Integridad padre/hijo por cliente + IDOR de review links
-- =====================================================================
-- Problema (H4/H6 en plan-acceso-clientes.md): muchas tablas guardan un
-- client_id desnormalizado junto al id de una fila padre (deliverable_id,
-- conversation_id, …) sin validar que ambos sean del MISMO cliente. Un
-- usuario de otra org podía crear una fila suya (su client_id, que pasa la
-- RLS) apuntando a un padre ajeno. Con deliverable_review_links eso era un
-- IDOR real: review_link_get / review_link_comment (anon, por token) leían
-- y cambiaban el entregable por l.deliverable_id sin cruzarlo con
-- l.client_id → se leía el entregable y los comentarios de otra agencia y se
-- le cambiaba el estado.
--
-- Esta migración:
--   1. Crea public.enforce_parent_same_client(): trigger genérico
--      (SECURITY DEFINER, para ver el padre aunque la RLS lo oculte) que
--      rechaza INSERT/UPDATE si el padre existe y su client_id es distinto
--      al de la fila. Se deja pasar si la fila no tiene client_id, si el
--      padre no existe (la FK, si existe, responde por eso) o si el padre
--      tiene client_id nulo.
--   2. Lo engancha a cada par hijo→padre que escribe un usuario o el
--      servidor con ids que vienen del navegador.
--   3. deliverable_review_links: INSERT/UPDATE exigen can_edit_client y que
--      el entregable sea del mismo cliente; DELETE exige can_edit_client.
--   4. review_link_get / review_link_comment cruzan el entregable y los
--      comentarios con l.client_id (defensa en profundidad además del
--      trigger) y pasan a search_path vacío.
--
-- Datos actuales (verificado con SELECT el 2026-10-06): 0 filas
-- inconsistentes en todos los pares y 0 review links, así que ningún
-- trigger falla sobre datos existentes (los triggers no revalidan filas
-- viejas; solo actúan en INSERT/UPDATE nuevos).
--
-- Fuera de alcance: lead_meta.source_id (polimórfico según source) e
-- ig_automation_events (solo lo escribe el webhook con service_role).
--
-- Re-ejecutable: CREATE OR REPLACE, DROP … IF EXISTS antes de cada CREATE.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.enforce_parent_same_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _parent_table text := TG_ARGV[0];
  _fk_col       text := TG_ARGV[1];
  _parent_id    uuid;
  _mismatch     boolean;
BEGIN
  -- Sin client_id no hay nada que cruzar (la RLS y los NOT NULL responden por eso).
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;
  _parent_id := nullif(to_jsonb(NEW) ->> _fk_col, '')::uuid;
  IF _parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM public.%I p
                     WHERE p.id = $1
                       AND p.client_id IS NOT NULL
                       AND p.client_id IS DISTINCT FROM $2)',
    _parent_table
  ) INTO _mismatch USING _parent_id, NEW.client_id;

  IF _mismatch THEN
    RAISE EXCEPTION '%.% apunta a un registro de otro cliente', TG_TABLE_NAME, _fk_col
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Función de trigger: nadie la llama directo.
REVOKE ALL ON FUNCTION public.enforce_parent_same_client() FROM PUBLIC, anon, authenticated;

-- Engancha dos triggers por par (hijo.fk → padre): uno en INSERT y otro en
-- UPDATE que solo se dispara cuando de verdad cambia la FK o el client_id
-- (WHEN … IS DISTINCT FROM), para no pagar la consulta en updates normales.
DO $$
DECLARE
  r record;
  _base text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('deliverable_comments',        'deliverable_id',  'deliverables'),
      ('deliverable_review_links',    'deliverable_id',  'deliverables'),
      ('deliverables',                'folder_id',       'deliverable_folders'),
      ('deliverables',                'instagram_post_id','instagram_posts'),
      ('instagram_posts',             'version_id',      'instagram_grid_versions'),
      ('instagram_post_comments',     'post_id',         'instagram_posts'),
      ('multilink_items',             'multilink_id',    'multilinks'),
      ('landing_contact_submissions', 'landing_id',      'landing_pages'),
      ('whatsapp_conversations',      'account_id',      'whatsapp_accounts'),
      ('whatsapp_messages',           'conversation_id', 'whatsapp_conversations'),
      ('bot_knowledge',               'account_id',      'whatsapp_accounts'),
      ('client_leads',                'conversation_id', 'whatsapp_conversations'),
      ('attributions',                'conversation_id', 'whatsapp_conversations'),
      ('conversation_outcomes',       'conversation_id', 'whatsapp_conversations'),
      ('whatsapp_flow_runs',          'conversation_id', 'whatsapp_conversations'),
      ('whatsapp_flow_runs',          'rule_id',         'whatsapp_bot_rules'),
      ('meta_ads_campaigns',          'meta_account_id', 'meta_accounts'),
      ('meta_ads_adsets',             'campaign_id',     'meta_ads_campaigns'),
      ('meta_ads_adsets',             'meta_account_id', 'meta_accounts'),
      ('meta_ads_ads',                'adset_id',        'meta_ads_adsets'),
      ('meta_ads_ads',                'meta_account_id', 'meta_accounts'),
      ('payments',                    'proposal_id',     'proposals')
    ) AS v(child, fk_col, parent)
  LOOP
    _base := format('t_%s_%s_same_client', r.child, r.fk_col);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', _base, r.child);  -- versión previa
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', _base || '_ins', r.child);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', _base || '_upd', r.child);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.enforce_parent_same_client(%L, %L)',
      _base || '_ins', r.child, r.parent, r.fk_col
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OF %I, client_id ON public.%I
         FOR EACH ROW
         WHEN (OLD.%I IS DISTINCT FROM NEW.%I OR OLD.client_id IS DISTINCT FROM NEW.client_id)
         EXECUTE FUNCTION public.enforce_parent_same_client(%L, %L)',
      _base || '_upd', r.fk_col, r.child, r.fk_col, r.fk_col, r.parent, r.fk_col
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- deliverable_review_links: solo editores de la agencia y mismo cliente.
-- (SELECT sigue con owns_client: un viewer puede ver los links.)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "agency creates review links" ON public.deliverable_review_links;
CREATE POLICY "agency creates review links" ON public.deliverable_review_links
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_client(client_id)
    AND EXISTS (
      SELECT 1 FROM public.deliverables d
       WHERE d.id = deliverable_review_links.deliverable_id
         AND d.client_id = deliverable_review_links.client_id
    )
  );

DROP POLICY IF EXISTS "agency updates review links" ON public.deliverable_review_links;
CREATE POLICY "agency updates review links" ON public.deliverable_review_links
  FOR UPDATE TO authenticated
  USING (public.can_edit_client(client_id))
  WITH CHECK (
    public.can_edit_client(client_id)
    AND EXISTS (
      SELECT 1 FROM public.deliverables d
       WHERE d.id = deliverable_review_links.deliverable_id
         AND d.client_id = deliverable_review_links.client_id
    )
  );

DROP POLICY IF EXISTS "agency deletes review links" ON public.deliverable_review_links;
CREATE POLICY "agency deletes review links" ON public.deliverable_review_links
  FOR DELETE TO authenticated
  USING (public.can_edit_client(client_id));

-- ---------------------------------------------------------------------
-- RPC públicas por token: siempre cruzan con l.client_id.
-- CREATE OR REPLACE conserva los GRANT actuales (anon/authenticated).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_link_get(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE l record; d record; res jsonb;
BEGIN
  SELECT * INTO l FROM public.deliverable_review_links
   WHERE token = _token AND revoked = false AND expires_at > now();
  IF l IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;

  SELECT id, title, description, status, type, due_date, file_url, file_name, file_size, mime_type
    INTO d
    FROM public.deliverables
   WHERE id = l.deliverable_id
     AND client_id = l.client_id;
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
      FROM public.deliverable_comments c
      WHERE c.deliverable_id = d.id
        AND c.client_id = l.client_id
    ), '[]'::jsonb)
  ) INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.review_link_comment(
  _token text, _kind text, _body text, _name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  -- El entregable debe ser del mismo cliente que el link.
  IF NOT EXISTS (
    SELECT 1 FROM public.deliverables
     WHERE id = l.deliverable_id AND client_id = l.client_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  INSERT INTO public.deliverable_comments
    (deliverable_id, client_id, author, author_role, author_name, read_by_agency, kind, body)
  VALUES
    (l.deliverable_id, l.client_id, 'guest', 'guest',
     left(nullif(btrim(coalesce(_name, '')), ''), 120), false, _kind, left(btrim(_body), 4000));

  IF _kind = 'approval' THEN
    UPDATE public.deliverables SET status = 'done'
     WHERE id = l.deliverable_id AND client_id = l.client_id;
  ELSIF _kind = 'change_request' THEN
    UPDATE public.deliverables SET status = 'in_progress'
     WHERE id = l.deliverable_id AND client_id = l.client_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

NOTIFY pgrst, 'reload schema';
