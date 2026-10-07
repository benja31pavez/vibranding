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
-- Cliente que puede leer quien llama en el panel:
--   usuario cliente  → user_client_id() (siempre; _preview se ignora)
--   agencia          → _preview, solo si owns_client(_preview)
--   resto            → NULL
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
  'Panel del cliente: cliente legible por quien llama (user_client_id(), o _preview si es agencia dueña).';

-- ---------------------------------------------------------------------
-- Plan: plan contratado, etapas, tareas y objetivos (solo lectura).
--   plan_key  : client_billing.plan_key (sin mrr, billing_day ni token)
--   addons    : service_key de contratos FIRMADOS (para las etapas adicionales)
--   stages    : deliverables → id, title, status, due_date, sort_order, stage_key
--   tasks     : client_tasks → id, title, status, due_date, sort_order,
--               stage_key, delivered_at, approved_at, created_at y "marker"
--               (solo el marcador [plantilla:…] / [plan-mes:…] para deducir la
--               etapa; NUNCA la descripción ni el assignee). Sin tareas
--               retiradas ([plantilla-antigua:…]).
--   objectives: id, title, status, due_date, target_value, current_value,
--               unit, sort_order (sin descripción, fuente de métrica ni plantilla)
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
BEGIN
  IF v_client IS NULL THEN
    RETURN NULL;
  END IF;
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
    'stages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', d.id, 'title', d.title, 'status', d.status, 'due_date', d.due_date,
               'sort_order', d.sort_order, 'stage_key', d.stage_key)
             ORDER BY d.sort_order, d.created_at)
        FROM (SELECT * FROM public.deliverables
               WHERE client_id = v_client
               ORDER BY sort_order, created_at
               LIMIT 500) d
    ), '[]'::jsonb),
    'tasks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', t.id, 'title', t.title, 'status', t.status, 'due_date', t.due_date,
               'sort_order', t.sort_order, 'stage_key', t.stage_key,
               'delivered_at', t.delivered_at, 'approved_at', t.approved_at,
               'created_at', t.created_at,
               'marker', substring(t.description FROM '\[(?:plantilla|plan-mes):[^]]*\]'))
             ORDER BY t.due_date NULLS LAST, t.created_at)
        FROM (SELECT * FROM public.client_tasks
               WHERE client_id = v_client
                 AND COALESCE(description, '') NOT LIKE '%[plantilla-antigua:%'
               ORDER BY due_date NULLS LAST, created_at
               LIMIT 500) t
    ), '[]'::jsonb),
    'objectives', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', o.id, 'title', o.title, 'status', o.status, 'due_date', o.due_date,
               'target_value', o.target_value, 'current_value', o.current_value,
               'unit', o.unit, 'sort_order', o.sort_order)
             ORDER BY o.sort_order, o.created_at)
        FROM (SELECT * FROM public.objectives
               WHERE client_id = v_client
               ORDER BY sort_order, created_at
               LIMIT 200) o
    ), '[]'::jsonb)
  );
END $$;

-- ---------------------------------------------------------------------
-- Archivos: catálogo de lo ENTREGADO al cliente (las URLs se firman en el
-- servidor; aquí solo se devuelven rutas/URLs guardadas).
--   client_id    : para que el servidor valide las rutas de Storage
--   deliverables : con archivo y ya entregados (in_review / done)
--   posts        : piezas de Vibranding que pasaron por aprobación o se
--                  publicaron (sin notas de aprobación, likes ni ids de Meta)
--   ads          : creatividades de anuncios no borrador (sin textos, links,
--                  ids de Meta, presupuestos ni cuentas)
--   reports      : reportes ENVIADOS (sent_at no nulo) con su token: es el
--                  mismo enlace /r/<token> que ya se le envió al cliente
--   files        : client_files (agencia y cliente) con su ruta privada
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
BEGIN
  IF v_client IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'client_id', v_client,
    'deliverables', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', d.id, 'title', d.title, 'type', d.type, 'status', d.status,
               'file_url', d.file_url, 'file_name', d.file_name, 'mime_type', d.mime_type,
               'created_at', d.created_at, 'instagram_post_id', d.instagram_post_id))
        FROM (SELECT * FROM public.deliverables
               WHERE client_id = v_client
                 AND file_url IS NOT NULL
                 AND status IN ('in_review', 'done')
               ORDER BY created_at DESC
               LIMIT 500) d
    ), '[]'::jsonb),
    'posts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id, 'caption', p.caption, 'format', p.format, 'type', p.type,
               'image_url', p.image_url, 'cover_url', p.cover_url,
               'carousel_urls', p.carousel_urls, 'published_at', p.published_at,
               'scheduled_at', p.scheduled_at, 'created_at', p.created_at,
               'approval_status', p.approval_status))
        FROM (SELECT * FROM public.instagram_posts
               WHERE client_id = v_client
                 AND archived_at IS NULL
                 AND version_id IS NULL
                 AND (approval_status IS NOT NULL
                      OR (type = 'proposed' AND published_at IS NOT NULL))
               ORDER BY created_at DESC
               LIMIT 500) p
    ), '[]'::jsonb),
    'ads', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', a.id, 'name', a.name, 'image_url', a.image_url,
               'video_url', a.video_url, 'carousel_urls', a.carousel_urls,
               'status', a.status, 'created_at', a.created_at))
        FROM (SELECT * FROM public.meta_ads_ads
               WHERE client_id = v_client
                 AND status NOT IN ('DRAFT', 'DELETED')
               ORDER BY created_at DESC
               LIMIT 200) a
    ), '[]'::jsonb),
    'reports', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', r.id, 'period', r.period, 'token', r.token, 'sent_at', r.sent_at)
             ORDER BY r.period DESC)
        FROM public.monthly_reports r
       WHERE r.client_id = v_client
         AND r.sent_at IS NOT NULL
    ), '[]'::jsonb),
    'files', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', f.id, 'path', f.path, 'name', f.name, 'size', f.size, 'mime', f.mime,
               'uploader_kind', f.uploader_kind, 'created_at', f.created_at))
        FROM (SELECT * FROM public.client_files
               WHERE client_id = v_client
               ORDER BY created_at DESC
               LIMIT 500) f
    ), '[]'::jsonb)
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

NOTIFY pgrst, 'reload schema';
