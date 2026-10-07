-- =====================================================================
-- Acceso de clientes · Fase 2 — Lectura de Leads, WhatsApp e Instagram
-- para el panel del cliente (/mi)
-- =====================================================================
-- Decisiones de Benja (plan-acceso-clientes.md): el cliente ve los leads de
-- SU negocio (D1), lee TODOS sus chats de WhatsApp (D3; responder es fase 3)
-- y ve su Instagram en solo lectura (aprobar posts es fase 3).
--
-- Modelo (igual que client_self / portal_payments):
--   * Ninguna tabla base se abre al rol del cliente. Las policies de
--     client_leads, lead_meta, landing_contact_submissions, whatsapp_*,
--     instagram_*, ig_engagement_snapshots NO cambian (siguen solo agencia).
--   * Cada lectura es un RPC SECURITY DEFINER `client_*` que fija el cliente
--     con public.client_panel_target(_preview) (migración 20261012002900):
--     usuario cliente → user_client_id() (ignora _preview); agencia → _preview
--     solo si owns_client(_preview) ("Ver como cliente"); otro → NULL (0 filas).
--     Devuelve columnas mínimas y pagina en el servidor (leads,
--     conversaciones, mensajes). El navegador no las llama directo: pasan por
--     server functions (src/lib/client-panel/channels.*) que validan la vista
--     previa con getClientOrgRole antes de llamar con la sesión del usuario.
--   * search_path = '' y nombres calificados. EXECUTE solo para
--     authenticated (REVOKE de PUBLIC y anon).
--
-- Columnas que NUNCA salen: lead_meta.notes/tags, client_leads.metadata,
-- landing_contact_submissions.ip_hash, whatsapp_accounts.ai_* (prompt,
-- contexto, modelo), *_secret_id, phone_number_id, waba_id, ids de cuentas,
-- whatsapp_conversations.ai_paused / needs_human_followup / human_followup_*
-- / lead_source_* / tags / dispatch_attempts, whatsapp_messages.wa_message_id
-- / media_url, instagram_posts.approval_note* / approved_by / version_id /
-- ig_media_id / objective, instagram_grid_versions.notes, errores de medición.
--
-- No se aplica sola: correr en el SQL Editor (re-ejecutable). Requiere
-- 20261012002900 (client_panel_target).
-- =====================================================================

-- Firmas anteriores (borrador de este PR, nunca aplicado): se reemplazan por
-- las que aceptan _preview.
DROP FUNCTION IF EXISTS public.client_leads_page(integer, integer);
DROP FUNCTION IF EXISTS public.client_leads_page(integer, integer, text);
DROP FUNCTION IF EXISTS public.client_whatsapp_status();
DROP FUNCTION IF EXISTS public.client_whatsapp_conversations(integer, integer);
DROP FUNCTION IF EXISTS public.client_whatsapp_messages(uuid, integer, timestamptz);
DROP FUNCTION IF EXISTS public.client_instagram_overview();

-- Leads de la landing por cliente y fecha (client_leads ya tiene su índice).
CREATE INDEX IF NOT EXISTS landing_contact_submissions_client_created_idx
  ON public.landing_contact_submissions (client_id, created_at DESC);

-- ---------------------------------------------------------------------
-- 1) Leads del cliente (paginado en servidor)
-- ---------------------------------------------------------------------
-- Mismas fuentes que la página de Leads de la agencia: conversaciones de
-- WhatsApp marcadas como lead (o derivadas al equipo), contactos de la
-- landing y client_leads (Meta Ads, multilink…). El estado sale de
-- lead_meta.status (sin notas ni tags); sin fila = 'new'. Un client_lead que
-- ya viene por su conversación de WhatsApp no se repite. _offset con tope.
CREATE OR REPLACE FUNCTION public.client_leads_page(
  _limit integer DEFAULT 10,
  _offset integer DEFAULT 0,
  _preview uuid DEFAULT NULL
)
RETURNS TABLE (
  source text,
  lead_id uuid,
  name text,
  contact text,
  message text,
  created_at timestamptz,
  status text,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH me AS (
    SELECT public.client_panel_target(_preview) AS client_id
  ),
  leads AS (
    SELECT 'whatsapp'::text AS source,
           c.id AS lead_id,
           coalesce(nullif(c.contact_name, ''), c.contact_wa_id) AS name,
           c.contact_wa_id AS contact,
           c.last_message_preview AS message,
           coalesce(c.last_message_at, c.created_at) AS created_at
      FROM public.whatsapp_conversations c, me
     WHERE c.client_id = me.client_id
       AND coalesce(c.channel, 'whatsapp') = 'whatsapp'
       AND (c.is_lead OR c.needs_human_followup)
    UNION ALL
    SELECT 'landing', s.id, s.name,
           nullif(concat_ws(' · ', nullif(s.email, ''), nullif(s.phone, '')), ''),
           s.message, s.created_at
      FROM public.landing_contact_submissions s, me
     WHERE s.client_id = me.client_id
    UNION ALL
    SELECT l.source, l.id, l.name, coalesce(nullif(l.contact, ''), l.email),
           l.message, l.created_at
      FROM public.client_leads l, me
     WHERE l.client_id = me.client_id
       AND NOT EXISTS (
         SELECT 1
           FROM public.whatsapp_conversations c
          WHERE c.id = l.conversation_id
            AND c.client_id = me.client_id
            AND coalesce(c.channel, 'whatsapp') = 'whatsapp'
            AND (c.is_lead OR c.needs_human_followup)
       )
  )
  SELECT l.source,
         l.lead_id,
         l.name,
         l.contact,
         left(l.message, 500),
         l.created_at,
         coalesce(m.status, 'new'),
         count(*) OVER ()
    FROM leads l
    LEFT JOIN public.lead_meta m
      ON m.client_id = (SELECT client_id FROM me)
     AND m.source = l.source
     AND m.source_id = l.lead_id
   ORDER BY l.created_at DESC NULLS LAST, l.lead_id
   LIMIT least(greatest(coalesce(_limit, 10), 1), 50)
  OFFSET least(greatest(coalesce(_offset, 0), 0), 10000);
$$;

COMMENT ON FUNCTION public.client_leads_page(integer, integer, uuid) IS
  'Panel del cliente: leads del cliente (client_panel_target), paginados. Sin notas, tags ni metadatos internos.';

-- ---------------------------------------------------------------------
-- 2) WhatsApp: estado de la línea (sin ids, tokens ni configuración del bot)
-- ---------------------------------------------------------------------
-- 0 filas = el cliente no tiene WhatsApp configurado.
CREATE OR REPLACE FUNCTION public.client_whatsapp_status(_preview uuid DEFAULT NULL)
RETURNS TABLE (
  connected boolean,
  display_phone_number text,
  business_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.connected, a.display_phone_number, a.business_name
    FROM public.whatsapp_accounts a
   WHERE a.client_id = public.client_panel_target(_preview)
   ORDER BY a.connected DESC, a.updated_at DESC
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.client_whatsapp_status(uuid) IS
  'Panel del cliente: ¿su WhatsApp está conectado? Solo booleano, número visible y nombre. Nunca prompt, tokens ni ids.';

-- ---------------------------------------------------------------------
-- 3) WhatsApp: conversaciones del cliente (paginadas en servidor)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_whatsapp_conversations(
  _limit integer DEFAULT 20,
  _offset integer DEFAULT 0,
  _preview uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  contact_name text,
  contact_phone text,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer,
  is_lead boolean,
  status text,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id,
         nullif(c.contact_name, ''),
         c.contact_wa_id,
         coalesce(c.last_message_at, c.created_at),
         left(c.last_message_preview, 200),
         coalesce(c.unread_count, 0),
         coalesce(c.is_lead, false),
         c.status,
         count(*) OVER ()
    FROM public.whatsapp_conversations c
   WHERE c.client_id = public.client_panel_target(_preview)
     AND coalesce(c.channel, 'whatsapp') = 'whatsapp'
   ORDER BY coalesce(c.last_message_at, c.created_at) DESC NULLS LAST, c.id
   LIMIT least(greatest(coalesce(_limit, 20), 1), 50)
  OFFSET least(greatest(coalesce(_offset, 0), 0), 10000);
$$;

COMMENT ON FUNCTION public.client_whatsapp_conversations(integer, integer, uuid) IS
  'Panel del cliente: sus conversaciones de WhatsApp, paginadas. Sin estado del bot, seguimientos internos, atribución ni tags.';

-- ---------------------------------------------------------------------
-- 4) WhatsApp: mensajes de UNA conversación del cliente, más nuevos primero.
--    Cursor keyset (timestamp, id) del mensaje más antiguo ya cargado; usa
--    idx_wa_msg_conv (conversation_id, timestamp). timestamp es NOT NULL.
--    Si la conversación no es del cliente, 0 filas (no revela si existe).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_whatsapp_messages(
  _conversation_id uuid,
  _limit integer DEFAULT 40,
  _before timestamptz DEFAULT NULL,
  _before_id uuid DEFAULT NULL,
  _preview uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  direction text,
  from_bot boolean,
  type text,
  body text,
  status text,
  sent_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT m.id,
         m.direction,
         coalesce(m.from_bot, false),
         m.type,
         m.body,
         m.status,
         m.timestamp
    FROM public.whatsapp_messages m
    JOIN public.whatsapp_conversations c
      ON c.id = m.conversation_id
     AND c.client_id = m.client_id
   WHERE m.conversation_id = _conversation_id
     AND c.client_id = public.client_panel_target(_preview)
     AND coalesce(c.channel, 'whatsapp') = 'whatsapp'
     AND (
       _before IS NULL
       OR m.timestamp < _before
       OR (_before_id IS NOT NULL AND m.timestamp = _before AND m.id < _before_id)
     )
   ORDER BY m.timestamp DESC, m.id DESC
   LIMIT least(greatest(coalesce(_limit, 40), 1), 100);
$$;

COMMENT ON FUNCTION public.client_whatsapp_messages(uuid, integer, timestamptz, uuid, uuid) IS
  'Panel del cliente: mensajes de una conversación SUYA (cruza conversation.client_id con client_panel_target). Sin ids de Meta ni media_url.';

-- ---------------------------------------------------------------------
-- 5) Instagram (solo lectura): perfil actual/propuesto, publicaciones,
--    destacadas y la última medición de engagement, en un solo jsonb.
--    Publicaciones:
--      * "proposed": la propuesta vigente (version_id NULL, sin archivar) SOLO
--        si ya se envió a aprobación (approval_status no nulo): nunca
--        borradores.
--      * "current": la versión Actual más reciente (o la base si no hay
--        otra), excluyendo versiones temporales "· sincronizando".
--    Máximo 60 por lado (es una grilla, no un historial).
--    Engagement: solo mediciones de la cuenta conectada del cliente
--    (source = 'own'), nunca de un perfil ajeno vía Business Discovery.
--    client_id va en la respuesta para que el servidor firme solo rutas de
--    client-media de ESE cliente. NULL si no hay cliente legible.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_instagram_overview(_preview uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _client uuid := public.client_panel_target(_preview);
  _version uuid;
  _version_label text;
  _version_at timestamptz;
BEGIN
  IF _client IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT v.id, v.label, v.captured_at
    INTO _version, _version_label, _version_at
    FROM public.instagram_grid_versions v
   WHERE v.client_id = _client
     AND v.label NOT LIKE '%· sincronizando%'
   ORDER BY v.is_baseline ASC, v.captured_at DESC
   LIMIT 1;

  RETURN jsonb_build_object(
    'client_id', _client,
    'profile', (
      SELECT jsonb_build_object(
        'current_username', p.current_username,
        'current_display_name', p.current_display_name,
        'current_followers', p.current_followers,
        'current_following', p.current_following,
        'current_posts_count', p.current_posts_count,
        'current_avatar_url', p.current_avatar_url,
        'current_bio', p.current_bio,
        'current_link', p.current_link,
        'current_account_type', p.current_account_type,
        'current_category', p.current_category,
        'current_verified', p.current_verified,
        'current_threads_enabled', p.current_threads_enabled,
        'current_threads_handle', p.current_threads_handle,
        'current_song_enabled', p.current_song_enabled,
        'current_song', p.current_song,
        'current_show_contact_button', p.current_show_contact_button,
        'current_contact_phone', p.current_contact_phone,
        'current_contact_email', p.current_contact_email,
        'current_synced_at', p.current_synced_at,
        'proposed_username', p.proposed_username,
        'proposed_display_name', p.proposed_display_name,
        'proposed_followers', p.proposed_followers,
        'proposed_following', p.proposed_following,
        'proposed_posts_count', p.proposed_posts_count,
        'proposed_avatar_url', p.proposed_avatar_url,
        'proposed_bio', p.proposed_bio,
        'proposed_link', p.proposed_link,
        'proposed_account_type', p.proposed_account_type,
        'proposed_category', p.proposed_category,
        'proposed_verified', p.proposed_verified,
        'proposed_threads_enabled', p.proposed_threads_enabled,
        'proposed_threads_handle', p.proposed_threads_handle,
        'proposed_song_enabled', p.proposed_song_enabled,
        'proposed_song', p.proposed_song,
        'proposed_show_contact_button', p.proposed_show_contact_button,
        'proposed_contact_phone', p.proposed_contact_phone,
        'proposed_contact_email', p.proposed_contact_email
      )
        FROM public.instagram_profiles p
       WHERE p.client_id = _client
       ORDER BY p.updated_at DESC
       LIMIT 1
    ),
    'current_version', CASE WHEN _version IS NULL THEN NULL ELSE
      jsonb_build_object('label', _version_label, 'captured_at', _version_at) END,
    'posts', coalesce((
      SELECT jsonb_agg(x.post ORDER BY x.side, x.position)
        FROM (
          SELECT s.side, s.position, jsonb_build_object(
                   'id', s.id,
                   'type', s.side,
                   'position', s.position,
                   'format', s.format,
                   'image_url', s.image_url,
                   'cover_url', s.cover_url,
                   'carousel_urls', coalesce(to_jsonb(s.carousel_urls), '[]'::jsonb),
                   'caption', s.caption,
                   'scheduled_at', s.scheduled_at,
                   'published_at', s.published_at,
                   'likes_count', coalesce(s.likes_count, 0),
                   'is_trial_reel', coalesce(s.is_trial_reel, false),
                   'close_friends_only', coalesce(s.close_friends_only, false),
                   'music', s.music,
                   'location', s.location,
                   'approval_status', s.approval_status
                 ) AS post
            FROM (
              (SELECT 'proposed'::text AS side, ip.*
                 FROM public.instagram_posts ip
                WHERE ip.client_id = _client
                  AND ip.type = 'proposed'
                  AND ip.version_id IS NULL
                  AND ip.archived_at IS NULL
                  AND ip.approval_status IS NOT NULL
                ORDER BY ip.position
                LIMIT 60)
              UNION ALL
              (SELECT 'current'::text, ip.*
                 FROM public.instagram_posts ip
                WHERE ip.client_id = _client
                  AND _version IS NOT NULL
                  AND ip.version_id = _version
                ORDER BY ip.position
                LIMIT 60)
            ) s
        ) x
    ), '[]'::jsonb),
    'highlights', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', h.id,
               'type', h.type,
               'position', h.position,
               'title', h.title,
               'cover_url', h.cover_url,
               'media_urls', coalesce(to_jsonb(h.media_urls), '[]'::jsonb)
             ) ORDER BY h.type, h.position)
        FROM public.instagram_highlights h
       WHERE h.client_id = _client
    ), '[]'::jsonb),
    'engagement', (
      SELECT jsonb_build_object(
               'measured_at', e.measured_at,
               'followers', e.followers,
               'engagement_rate', e.engagement_rate,
               'avg_likes', e.avg_likes,
               'avg_comments', e.avg_comments,
               'posts_per_week', e.posts_per_week,
               'posts_sampled', e.posts_sampled
             )
        FROM public.ig_engagement_snapshots e
       WHERE e.client_id = _client
         AND e.source = 'own'
         AND e.error IS NULL
         AND e.engagement_rate IS NOT NULL
       ORDER BY e.measured_at DESC
       LIMIT 1
    )
  );
END;
$$;

COMMENT ON FUNCTION public.client_instagram_overview(uuid) IS
  'Panel del cliente: su Instagram en solo lectura (perfil actual/propuesto, grilla, destacadas, último engagement). Sin notas de aprobación, versiones internas ni ids de Meta.';

-- ---------------------------------------------------------------------
-- Permisos: solo authenticated (client_panel_target devuelve NULL a quien no
-- es el cliente ni su agencia: 0 filas / NULL). anon y PUBLIC sin EXECUTE.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.client_leads_page(integer, integer, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_whatsapp_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_whatsapp_conversations(integer, integer, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_whatsapp_messages(uuid, integer, timestamptz, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_instagram_overview(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.client_leads_page(integer, integer, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.client_whatsapp_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.client_whatsapp_conversations(integer, integer, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.client_whatsapp_messages(uuid, integer, timestamptz, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.client_instagram_overview(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
