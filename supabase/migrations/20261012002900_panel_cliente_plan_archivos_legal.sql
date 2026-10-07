-- =====================================================================
-- Acceso de clientes · Fase 2 — Lectura de Plan, Archivos y Legal en /mi
-- =====================================================================
-- El panel del cliente (/mi) lee SOLO por estas RPC. Ninguna abre SELECT de
-- tablas internas al rol del cliente: son SECURITY DEFINER, fijan el cliente
-- con user_client_id() y devuelven columnas mínimas (nada de assignee, notas,
-- descripciones internas, MRR, tokens de onboarding ni borradores).
--
-- Vista previa de la agencia ("Ver como cliente"): el parámetro _preview solo
-- se acepta si quien llama NO es usuario cliente y es miembro de la org dueña
-- de ese cliente (owns_client). Un usuario cliente que lo envíe recibe SU
-- cliente (el parámetro se ignora). Cualquier otro caso → NULL (nada).
-- Las server functions además validan la vista previa con getClientOrgRole.
--
-- EXECUTE: solo authenticated (nunca PUBLIC ni anon).
-- Re-ejecutable (CREATE OR REPLACE + REVOKE/GRANT idempotentes).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cliente que puede leer quien llama en el panel (helper COMÚN de /mi):
--   usuario cliente  → user_client_id() (siempre; _preview se ignora)
--   agencia          → _preview, solo si owns_client(_preview)
--   resto            → NULL
-- Lo usan todas las RPC client_* del panel (esta fase y las de las otras
-- secciones, p. ej. 20261012002910 / 20261012002920) para soportar "Ver como
-- cliente". Su firma (uuid DEFAULT NULL → uuid) NO debe cambiar. Ejecutable por
-- authenticated: no filtra nada que owns_client/user_client_id no digan ya.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_panel_target(_preview uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_self uuid := public.user_client_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_self IS NOT NULL THEN
    RETURN v_self;
  END IF;
  IF _preview IS NOT NULL AND public.owns_client(_preview) THEN
    RETURN _preview;
  END IF;
  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.client_panel_target(uuid) IS
  'Panel del cliente (helper común de las RPC client_*): user_client_id(), o _preview si quien llama es de la agencia dueña. Firma estable.';

-- ---------------------------------------------------------------------
-- Plan: plan contratado, etapas, tareas DEL PLAN y objetivos (solo lectura).
--   plan_key  : client_billing.plan_key (sin mrr, billing_day ni token)
--   addons    : service_key de contratos FIRMADOS (etapas adicionales)
--   stages    : solo filas de deliverables que SON etapas (stage_key o título
--               de etapa conocido): stage_key, title, status, due_date, sort_order
--   tasks     : solo tareas del plan (con stage_key o con marcador
--               [plantilla:…]/[plan-mes:…]); las tareas manuales internas de la
--               agencia no salen. Columnas: id, title, status, due_date,
--               sort_order, stage_key, delivered_at, approved_at, created_at y
--               "marker" (solo el marcador; NUNCA la descripción ni el assignee).
--               Sin tareas retiradas ([plantilla-antigua:…]).
--   objectives: id, title, status, due_date, target_value, current_value,
--               unit, sort_order (sin descripción, fuente de métrica ni plantilla)
--   truncated : true si alguna lista llegó a su tope (500 / 200)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_plan_board(_preview uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_client uuid := public.client_panel_target(_preview);
  v_stage_titles text[] := ARRAY[
    'estrategia', 'branding', 'branding / diseno', 'marca', 'identidad de marca',
    'kit de marca', 'diseno', 'planificacion de contenido', 'planificacion',
    'contenido', 'plan de contenido', 'ads', 'ads (meta / google)', 'meta ads',
    'publicidad', 'campanas', 'landing page', 'landing / web', 'landing',
    'pagina web', 'sitio web', 'web', 'chatbot', 'chatbot whatsapp',
    'optimizacion', 'optimizacion de perfil', 'reporte', 'reporte mensual', 'entrega'];
  v_stages jsonb;
  v_tasks jsonb;
  v_objectives jsonb;
  v_truncated boolean;
BEGIN
  IF v_client IS NULL THEN
    RETURN NULL;
  END IF;

  WITH s AS (
    SELECT d.* FROM public.deliverables d
     WHERE d.client_id = v_client
       AND (d.stage_key IS NOT NULL
            OR lower(regexp_replace(translate(btrim(d.title), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'),
                                    '\s+', ' ', 'g')) = ANY (v_stage_titles))
     ORDER BY d.sort_order, d.created_at
     LIMIT 501
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', x.id, 'title', x.title, 'status', x.status, 'due_date', x.due_date,
           'sort_order', x.sort_order, 'stage_key', x.stage_key)
         ORDER BY x.sort_order, x.created_at), '[]'::jsonb),
         (SELECT count(*) FROM s) > 500
    INTO v_stages, v_truncated
    FROM (SELECT * FROM s ORDER BY sort_order, created_at LIMIT 500) x;

  WITH t AS (
    SELECT ct.* FROM public.client_tasks ct
     WHERE ct.client_id = v_client
       AND COALESCE(ct.description, '') NOT LIKE '%[plantilla-antigua:%'
       AND (ct.stage_key IS NOT NULL
            OR ct.description ~ '\[(?:plantilla|plan-mes):[^]]*\]')
     ORDER BY ct.due_date NULLS LAST, ct.created_at
     LIMIT 501
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', x.id, 'title', x.title, 'status', x.status, 'due_date', x.due_date,
           'sort_order', x.sort_order, 'stage_key', x.stage_key,
           'delivered_at', x.delivered_at, 'approved_at', x.approved_at,
           'created_at', x.created_at,
           'marker', substring(x.description FROM '\[(?:plantilla|plan-mes):[^]]*\]'))
         ORDER BY x.due_date NULLS LAST, x.created_at), '[]'::jsonb),
         v_truncated OR (SELECT count(*) FROM t) > 500
    INTO v_tasks, v_truncated
    FROM (SELECT * FROM t ORDER BY due_date NULLS LAST, created_at LIMIT 500) x;

  WITH o AS (
    SELECT ob.* FROM public.objectives ob
     WHERE ob.client_id = v_client
     ORDER BY ob.sort_order, ob.created_at
     LIMIT 201
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', x.id, 'title', x.title, 'status', x.status, 'due_date', x.due_date,
           'target_value', x.target_value, 'current_value', x.current_value,
           'unit', x.unit, 'sort_order', x.sort_order)
         ORDER BY x.sort_order, x.created_at), '[]'::jsonb),
         v_truncated OR (SELECT count(*) FROM o) > 200
    INTO v_objectives, v_truncated
    FROM (SELECT * FROM o ORDER BY sort_order, created_at LIMIT 200) x;

  RETURN jsonb_build_object(
    'plan_key', (SELECT b.plan_key FROM public.client_billing b WHERE b.client_id = v_client),
    'addons', COALESCE((
      SELECT jsonb_agg(DISTINCT line ->> 'service_key')
        FROM public.client_contracts c
        CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(c.services_snapshot) = 'array'
               THEN c.services_snapshot ELSE '[]'::jsonb END) AS line
       WHERE c.client_id = v_client
         AND c.status = 'signed'
         AND line ->> 'service_key' IS NOT NULL
    ), '[]'::jsonb),
    'stages', v_stages,
    'tasks', v_tasks,
    'objectives', v_objectives,
    'truncated', v_truncated
  );
END $$;

-- ---------------------------------------------------------------------
-- Archivos: catálogo de lo ENTREGADO al cliente (las URLs se firman en el
-- servidor; aquí solo se devuelven rutas/URLs guardadas).
--   client_id    : para que el servidor valide las rutas de Storage
--   posts        : piezas de Vibranding que pasaron por aprobación o se
--                  publicaron (sin notas de aprobación, likes ni ids de Meta)
--   deliverables : con archivo y ya entregados (in_review / done). Los ligados
--                  a un post que ya va en "posts" se omiten AQUÍ (deduplicado en
--                  la BD); instagram_post_id no sale al navegador.
--   ads          : creatividades de anuncios no borrador (sin textos, links,
--                  ids de Meta, presupuestos ni cuentas)
--   reports      : reportes ENVIADOS (sent_at no nulo) con su token: es el
--                  mismo enlace /r/<token> que ya se le envió al cliente
--   files        : client_files (agencia y cliente) con su ruta privada
--   truncated    : true si alguna lista llegó a su tope (500 / 200 / 100)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_files_catalog(_preview uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_client uuid := public.client_panel_target(_preview);
  v_posts jsonb;
  v_deliverables jsonb;
  v_ads jsonb;
  v_reports jsonb;
  v_files jsonb;
  v_truncated boolean := false;
  n bigint;
BEGIN
  IF v_client IS NULL THEN
    RETURN NULL;
  END IF;

  -- Posts visibles para el cliente (los entregables ligados a ellos se omiten abajo).
  WITH p AS (
    SELECT ip.* FROM public.instagram_posts ip
     WHERE ip.client_id = v_client
       AND ip.archived_at IS NULL
       AND ip.version_id IS NULL
       AND (ip.approval_status IS NOT NULL
            OR (ip.type = 'proposed' AND ip.published_at IS NOT NULL))
     ORDER BY ip.created_at DESC
     LIMIT 501
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', x.id, 'caption', x.caption, 'format', x.format, 'type', x.type,
           'image_url', x.image_url, 'cover_url', x.cover_url,
           'carousel_urls', x.carousel_urls, 'published_at', x.published_at,
           'scheduled_at', x.scheduled_at, 'created_at', x.created_at,
           'approval_status', x.approval_status)), '[]'::jsonb),
         (SELECT count(*) FROM p)
    INTO v_posts, n
    FROM (SELECT * FROM p ORDER BY created_at DESC LIMIT 500) x;
  v_truncated := v_truncated OR n > 500;

  WITH d AS (
    SELECT dl.* FROM public.deliverables dl
     WHERE dl.client_id = v_client
       AND dl.file_url IS NOT NULL
       AND dl.status IN ('in_review', 'done')
       -- Deduplicado: un entregable ligado a un post que ya se muestra no se repite.
       AND (dl.instagram_post_id IS NULL OR NOT EXISTS (
             SELECT 1 FROM public.instagram_posts ip
              WHERE ip.id = dl.instagram_post_id
                AND ip.client_id = v_client
                AND ip.archived_at IS NULL
                AND ip.version_id IS NULL
                AND (ip.approval_status IS NOT NULL
                     OR (ip.type = 'proposed' AND ip.published_at IS NOT NULL))
                AND COALESCE(ip.image_url, ip.cover_url, ip.carousel_urls[1]) IS NOT NULL))
     ORDER BY dl.created_at DESC
     LIMIT 501
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', x.id, 'title', x.title, 'type', x.type, 'status', x.status,
           'file_url', x.file_url, 'file_name', x.file_name, 'mime_type', x.mime_type,
           'created_at', x.created_at)), '[]'::jsonb),
         (SELECT count(*) FROM d)
    INTO v_deliverables, n
    FROM (SELECT * FROM d ORDER BY created_at DESC LIMIT 500) x;
  v_truncated := v_truncated OR n > 500;

  WITH a AS (
    SELECT ad.* FROM public.meta_ads_ads ad
     WHERE ad.client_id = v_client
       AND ad.status NOT IN ('DRAFT', 'DELETED')
     ORDER BY ad.created_at DESC
     LIMIT 201
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', x.id, 'name', x.name, 'image_url', x.image_url,
           'video_url', x.video_url, 'carousel_urls', x.carousel_urls,
           'status', x.status, 'created_at', x.created_at)), '[]'::jsonb),
         (SELECT count(*) FROM a)
    INTO v_ads, n
    FROM (SELECT * FROM a ORDER BY created_at DESC LIMIT 200) x;
  v_truncated := v_truncated OR n > 200;

  WITH r AS (
    SELECT mr.* FROM public.monthly_reports mr
     WHERE mr.client_id = v_client
       AND mr.sent_at IS NOT NULL
     ORDER BY mr.period DESC
     LIMIT 101
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', x.id, 'period', x.period, 'token', x.token, 'sent_at', x.sent_at)
         ORDER BY x.period DESC), '[]'::jsonb),
         (SELECT count(*) FROM r)
    INTO v_reports, n
    FROM (SELECT * FROM r ORDER BY period DESC LIMIT 100) x;
  v_truncated := v_truncated OR n > 100;

  WITH f AS (
    SELECT cf.* FROM public.client_files cf
     WHERE cf.client_id = v_client
     ORDER BY cf.created_at DESC
     LIMIT 501
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', x.id, 'path', x.path, 'name', x.name, 'size', x.size, 'mime', x.mime,
           'uploader_kind', x.uploader_kind, 'created_at', x.created_at)), '[]'::jsonb),
         (SELECT count(*) FROM f)
    INTO v_files, n
    FROM (SELECT * FROM f ORDER BY created_at DESC LIMIT 500) x;
  v_truncated := v_truncated OR n > 500;

  RETURN jsonb_build_object(
    'client_id', v_client,
    'posts', v_posts,
    'deliverables', v_deliverables,
    'ads', v_ads,
    'reports', v_reports,
    'files', v_files,
    'truncated', v_truncated
  );
END $$;

-- ---------------------------------------------------------------------
-- Legal: contratos ENVIADOS o FIRMADOS (nunca borradores ni cancelados) con
-- lo que ya está impreso en el documento que se le entrega al cliente.
--   Sin notes. De agency_snapshot solo los datos legales que el documento
--   muestra (razón social, RUT, dirección, correo, jurisdicción, ley, base de
--   precios); cualquier otra clave interna queda fuera.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_contracts_list(_preview uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_client uuid := public.client_panel_target(_preview);
BEGIN
  IF v_client IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', c.id,
             'title', c.title,
             'status', c.status,
             'currency', c.currency,
             'payment_due_days', c.payment_due_days,
             'effective_date', c.effective_date,
             'signed_at', c.signed_at,
             'created_at', c.created_at,
             'total_one_time', c.total_one_time,
             'total_monthly', c.total_monthly,
             'services', COALESCE(c.services_snapshot, '[]'::jsonb),
             'clauses', COALESCE(c.clauses_snapshot, '[]'::jsonb),
             'client', COALESCE(c.client_snapshot, '{}'::jsonb),
             'agency', jsonb_build_object(
               'name', c.agency_snapshot ->> 'name',
               'legal_name', c.agency_snapshot ->> 'legal_name',
               'tax_id', c.agency_snapshot ->> 'tax_id',
               'address', c.agency_snapshot ->> 'address',
               'email', c.agency_snapshot ->> 'email',
               'jurisdiction', c.agency_snapshot ->> 'jurisdiction',
               'governing_law', c.agency_snapshot ->> 'governing_law',
               'vat_included', c.agency_snapshot -> 'vat_included',
               'price_basis', c.agency_snapshot ->> 'price_basis'))
           ORDER BY COALESCE(c.signed_at, c.created_at) DESC)
      FROM (SELECT * FROM public.client_contracts
             WHERE client_id = v_client
               AND status IN ('sent', 'signed')
             ORDER BY created_at DESC
             LIMIT 50) c
  ), '[]'::jsonb);
END $$;

-- ---------------------------------------------------------------------
-- Permisos: Supabase da EXECUTE a PUBLIC/anon por defecto → se quita.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.client_panel_target(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_plan_board(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_files_catalog(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_contracts_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_panel_target(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_plan_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_files_catalog(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_contracts_list(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- Índices para las lecturas del panel (por cliente, más recientes primero).
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS deliverables_client_created_idx
  ON public.deliverables (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS objectives_client_sort_idx
  ON public.objectives (client_id, sort_order);
CREATE INDEX IF NOT EXISTS instagram_posts_client_created_idx
  ON public.instagram_posts (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS meta_ads_ads_client_idx
  ON public.meta_ads_ads (client_id);

NOTIFY pgrst, 'reload schema';
