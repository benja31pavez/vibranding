-- =====================================================================
-- Suite de aislamiento entre clientes / agencia (Fase 0).
-- =====================================================================
-- SOLO STAGING o una rama de Supabase: crea datos de prueba (orgs, clientes,
-- client_users, entregables) DENTRO de una transacción que termina en
-- ROLLBACK, pero igual escribe mientras corre. Nunca en producción.
--
-- Uso:  DATABASE_URL=postgres://… node scripts/check-aislamiento.mjs
--   (o) psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/aislamiento.sql
--
-- Requiere las migraciones 20261012002300 … 20261012002340, 20261012002800 y
-- 20261012002900 (RPC client_* del panel: Plan, Archivos, Legal) y 20261012002910
-- (Leads, WhatsApp, Instagram) aplicadas.
-- Cada fallo lanza una excepción "FALLO …" y aborta (ON_ERROR_STOP).
-- Los usuarios son UUID inventados: no hace falta crear cuentas en auth.users
-- porque auth.uid() se lee de request.jwt.claims.
-- =====================================================================
\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------
-- Datos de prueba (como el rol de la conexión, que salta RLS)
--   Agencia A (owner U_AG) con clientes C_A y C_B; U_CA = usuario de C_A.
--   Extraño X (owner U_X de su propia org) con su cliente C_X.
-- ---------------------------------------------------------------------
INSERT INTO public.orgs (id, name, owner_user_id) VALUES
  ('00000000-0000-4000-a000-00000000000a', 'TEST agencia A', '00000000-0000-4000-a000-0000000000a1'),
  ('00000000-0000-4000-a000-00000000000e', 'TEST org extraña', '00000000-0000-4000-a000-0000000000e1');
INSERT INTO public.org_members (org_id, user_id, role) VALUES
  ('00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000a1', 'owner'),
  ('00000000-0000-4000-a000-00000000000e', '00000000-0000-4000-a000-0000000000e1', 'owner');
INSERT INTO public.clients (id, user_id, name, org_id, notes) VALUES
  ('00000000-0000-4000-a000-0000000000ca', '00000000-0000-4000-a000-0000000000a1', 'TEST cliente A', '00000000-0000-4000-a000-00000000000a', 'NOTA INTERNA A'),
  ('00000000-0000-4000-a000-0000000000cb', '00000000-0000-4000-a000-0000000000a1', 'TEST cliente B', '00000000-0000-4000-a000-00000000000a', 'NOTA INTERNA B'),
  ('00000000-0000-4000-a000-0000000000cc', '00000000-0000-4000-a000-0000000000e1', 'TEST cliente X', '00000000-0000-4000-a000-00000000000e', NULL);
INSERT INTO public.client_users (user_id, client_id, email) VALUES
  ('00000000-0000-4000-a000-0000000000c1', '00000000-0000-4000-a000-0000000000ca', 'test-a@example.invalid');
INSERT INTO public.deliverables (id, client_id, title) VALUES
  ('00000000-0000-4000-a000-0000000000da', '00000000-0000-4000-a000-0000000000ca', 'TEST entregable A'),
  ('00000000-0000-4000-a000-0000000000db', '00000000-0000-4000-a000-0000000000cb', 'TEST entregable B');

-- Panel del cliente (Fase 2): datos con columnas internas que NUNCA deben salir.
INSERT INTO public.client_tasks (client_id, title, assignee, description) VALUES
  ('00000000-0000-4000-a000-0000000000ca', 'TEST tarea A', 'benjamin', 'NOTA INTERNA TAREA [plantilla:diseno:post-1]'),
  ('00000000-0000-4000-a000-0000000000ca', 'TEST tarea manual interna A', NULL, 'sin marcador'),
  ('00000000-0000-4000-a000-0000000000cb', 'TEST tarea B', 'antonia', NULL);
INSERT INTO public.objectives (client_id, title, description, target_value, current_value) VALUES
  ('00000000-0000-4000-a000-0000000000ca', 'TEST objetivo A', 'NOTA INTERNA OBJ', 100, 40);
INSERT INTO public.client_contracts (client_id, title, status, notes, agency_snapshot) VALUES
  ('00000000-0000-4000-a000-0000000000ca', 'TEST contrato A firmado', 'signed', 'NOTA CONTRATO', '{"name":"Agencia","secreto":"NO"}'),
  ('00000000-0000-4000-a000-0000000000ca', 'TEST contrato A borrador', 'draft', NULL, '{}'),
  ('00000000-0000-4000-a000-0000000000cb', 'TEST contrato B firmado', 'signed', NULL, '{}');
INSERT INTO public.monthly_reports (client_id, period, sent_at) VALUES
  ('00000000-0000-4000-a000-0000000000ca', '2026-09-01', now()),
  ('00000000-0000-4000-a000-0000000000ca', '2026-10-01', NULL);
UPDATE public.deliverables SET file_url = 'https://x.invalid/storage/v1/object/public/client-media/u/00000000-0000-4000-a000-0000000000ca/a.png', status = 'done'
 WHERE id = '00000000-0000-4000-a000-0000000000da';
UPDATE public.deliverables SET file_url = 'https://x.invalid/storage/v1/object/public/client-media/u/00000000-0000-4000-a000-0000000000cb/b.png', status = 'done'
 WHERE id = '00000000-0000-4000-a000-0000000000db';

-- Integridad (como superusuario: los triggers corren igual)
DO $$
BEGIN
  BEGIN
    INSERT INTO public.deliverable_review_links (deliverable_id, client_id, token, expires_at)
    VALUES ('00000000-0000-4000-a000-0000000000da', '00000000-0000-4000-a000-0000000000cc',
            'test-token-idor', now() + interval '1 day');
    RAISE EXCEPTION 'FALLO integridad: review link con entregable de otro cliente';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES ('00000000-0000-4000-a000-00000000000a', '00000000-0000-4000-a000-0000000000c1', 'viewer');
    RAISE EXCEPTION 'FALLO integridad: un usuario cliente quedó como miembro de una org';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ---------------------------------------------------------------------
-- 1) Usuario cliente A
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}', true);

DO $$
DECLARE q text; n bigint;
BEGIN
  -- Debe ver exactamente su cliente por client_self, y nada de clients.
  SELECT count(*) INTO n FROM public.client_self WHERE id = '00000000-0000-4000-a000-0000000000ca';
  IF n <> 1 THEN RAISE EXCEPTION 'FALLO (cliente A): client_self devolvió % filas', n; END IF;

  FOREACH q IN ARRAY ARRAY[
    'SELECT count(*) FROM public.clients',
    'SELECT count(*) FROM public.client_self WHERE id <> ''00000000-0000-4000-a000-0000000000ca''',
    'SELECT count(*) FROM public.deliverables WHERE client_id <> ''00000000-0000-4000-a000-0000000000ca''',
    'SELECT count(*) FROM public.deliverable_comments WHERE client_id <> ''00000000-0000-4000-a000-0000000000ca''',
    'SELECT count(*) FROM public.client_tasks WHERE client_id <> ''00000000-0000-4000-a000-0000000000ca''',
    'SELECT count(*) FROM public.proposals WHERE client_id IS DISTINCT FROM ''00000000-0000-4000-a000-0000000000ca'' OR status = ''borrador''',
    'SELECT count(*) FROM public.client_billing',
    'SELECT count(*) FROM public.payments',
    'SELECT count(*) FROM public.prospects',
    'SELECT count(*) FROM public.meta_accounts',
    'SELECT count(*) FROM public.whatsapp_accounts_safe',
    'SELECT count(*) FROM public.org_members',
    'SELECT count(*) FROM public.orgs',
    'SELECT count(*) FROM public.deliverable_review_links',
    'SELECT count(*) FROM public.lead_meta',
    'SELECT count(*) FROM public.campaign_alerts'
  ] LOOP
    BEGIN
      EXECUTE q INTO n;
    EXCEPTION WHEN insufficient_privilege THEN n := 0;
    END;
    IF n <> 0 THEN RAISE EXCEPTION 'FALLO (cliente A): % → % filas', q, n; END IF;
  END LOOP;

  -- No puede crear una org (ensure_org) ni escribir como agencia.
  BEGIN
    PERFORM public.ensure_org();
    RAISE EXCEPTION 'FALLO (cliente A): ensure_org() le creó una org';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.orgs (name, owner_user_id)
    VALUES ('TEST org de cliente', '00000000-0000-4000-a000-0000000000c1');
    RAISE EXCEPTION 'FALLO (cliente A): insertó una org directo';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.deliverables (client_id, title)
    VALUES ('00000000-0000-4000-a000-0000000000ca', 'TEST intruso');
    RAISE EXCEPTION 'FALLO (cliente A): pudo crear un entregable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Funciones del vault: sin EXECUTE.
  IF has_function_privilege('public.org_meta_get_secret(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALLO (cliente A): puede ejecutar org_meta_get_secret';
  END IF;
  -- No puede activarse el panel (/mi) ni moverse de cliente: 0 filas o error.
  BEGIN
    UPDATE public.client_users SET panel_enabled = true
     WHERE user_id = '00000000-0000-4000-a000-0000000000c1';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'FALLO (cliente A): cambió su panel_enabled'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.client_users SET client_id = '00000000-0000-4000-a000-0000000000cb'
     WHERE user_id = '00000000-0000-4000-a000-0000000000c1';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> 0 THEN RAISE EXCEPTION 'FALLO (cliente A): se movió a otro cliente'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  SELECT count(*) INTO n FROM public.client_users
   WHERE user_id = '00000000-0000-4000-a000-0000000000c1' AND panel_enabled;
  IF n <> 0 THEN RAISE EXCEPTION 'FALLO (cliente A): panel_enabled quedó en true'; END IF;
END $$;

-- Panel del cliente (Fase 2): las RPC client_* devuelven SOLO su cliente,
-- aunque pida la vista previa de B, y nunca columnas internas.
DO $$
DECLARE j jsonb; t text;
BEGIN
  IF public.client_panel_target('00000000-0000-4000-a000-0000000000cb')
     IS DISTINCT FROM '00000000-0000-4000-a000-0000000000ca' THEN
    RAISE EXCEPTION 'FALLO (cliente A): client_panel_target aceptó la vista previa de B';
  END IF;
  -- Plan
  j := public.client_plan_board('00000000-0000-4000-a000-0000000000cb');
  t := j::text;
  IF t NOT LIKE '%TEST tarea A%' OR t LIKE '%TEST tarea B%' THEN
    RAISE EXCEPTION 'FALLO (cliente A): client_plan_board no es solo de A: %', t;
  END IF;
  IF t LIKE '%NOTA INTERNA%' OR t LIKE '%benjamin%' OR t LIKE '%assignee%' THEN
    RAISE EXCEPTION 'FALLO (cliente A): client_plan_board expone notas o responsable interno';
  END IF;
  IF t LIKE '%tarea manual interna%' THEN
    RAISE EXCEPTION 'FALLO (cliente A): client_plan_board muestra tareas manuales internas';
  END IF;
  IF t NOT LIKE '%[plantilla:diseno:post-1]%' THEN
    RAISE EXCEPTION 'FALLO (cliente A): client_plan_board no devuelve el marcador de etapa';
  END IF;
  -- Archivos
  j := public.client_files_catalog('00000000-0000-4000-a000-0000000000cb');
  IF j ->> 'client_id' <> '00000000-0000-4000-a000-0000000000ca' THEN
    RAISE EXCEPTION 'FALLO (cliente A): client_files_catalog devolvió otro cliente';
  END IF;
  t := j::text;
  IF t LIKE '%instagram_post_id%' THEN
    RAISE EXCEPTION 'FALLO (cliente A): client_files_catalog expone instagram_post_id';
  END IF;
  IF t LIKE '%0000000000cb/b.png%' THEN
    RAISE EXCEPTION 'FALLO (cliente A): client_files_catalog incluye archivos de B';
  END IF;
  IF jsonb_array_length(j -> 'reports') <> 1 THEN
    RAISE EXCEPTION 'FALLO (cliente A): client_files_catalog devolvió reportes no enviados';
  END IF;
  -- Legal
  j := public.client_contracts_list('00000000-0000-4000-a000-0000000000cb');
  t := j::text;
  IF jsonb_array_length(j) <> 1 OR t NOT LIKE '%TEST contrato A firmado%' THEN
    RAISE EXCEPTION 'FALLO (cliente A): client_contracts_list no es solo el firmado de A: %', t;
  END IF;
  IF t LIKE '%NOTA CONTRATO%' OR t LIKE '%secreto%' OR t LIKE '%borrador%' THEN
    RAISE EXCEPTION 'FALLO (cliente A): client_contracts_list expone notas, borradores o datos internos';
  END IF;
END $$;
RESET ROLE;

-- ---------------------------------------------------------------------
-- 2) Usuario con org propia (extraño): nada de la agencia A
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000000e1","role":"authenticated"}', true);

DO $$
DECLARE q text; n bigint;
BEGIN
  FOREACH q IN ARRAY ARRAY[
    'SELECT count(*) FROM public.clients WHERE org_id <> ''00000000-0000-4000-a000-00000000000e''',
    'SELECT count(*) FROM public.client_self',
    'SELECT count(*) FROM public.deliverables WHERE client_id <> ''00000000-0000-4000-a000-0000000000cc''',
    'SELECT count(*) FROM public.client_billing WHERE client_id <> ''00000000-0000-4000-a000-0000000000cc''',
    'SELECT count(*) FROM public.org_members WHERE org_id <> ''00000000-0000-4000-a000-00000000000e''',
    'SELECT count(*) FROM public.client_users'
  ] LOOP
    BEGIN
      EXECUTE q INTO n;
    EXCEPTION WHEN insufficient_privilege THEN n := 0;
    END;
    IF n <> 0 THEN RAISE EXCEPTION 'FALLO (extraño): % → % filas', q, n; END IF;
  END LOOP;

  -- IDOR H4: link de revisión de SU cliente apuntando al entregable de A.
  BEGIN
    INSERT INTO public.deliverable_review_links (deliverable_id, client_id, token, expires_at)
    VALUES ('00000000-0000-4000-a000-0000000000da', '00000000-0000-4000-a000-0000000000cc',
            'test-token-idor-2', now() + interval '1 day');
    RAISE EXCEPTION 'FALLO (extraño): creó un review link a un entregable ajeno';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL;
  END;
  -- Panel (Fase 2): la vista previa de un cliente de OTRA org no devuelve nada.
  IF public.client_panel_target('00000000-0000-4000-a000-0000000000ca') IS NOT NULL
     OR public.client_plan_board('00000000-0000-4000-a000-0000000000ca') IS NOT NULL
     OR public.client_files_catalog('00000000-0000-4000-a000-0000000000ca') IS NOT NULL
     OR public.client_contracts_list('00000000-0000-4000-a000-0000000000ca') IS NOT NULL
     OR public.client_plan_board() IS NOT NULL THEN
    RAISE EXCEPTION 'FALLO (extraño): leyó el panel de un cliente de la agencia A';
  END IF;
  -- Comentario propio colgado de un entregable ajeno.
  BEGIN
    INSERT INTO public.deliverable_comments (deliverable_id, client_id, body)
    VALUES ('00000000-0000-4000-a000-0000000000da', '00000000-0000-4000-a000-0000000000cc', 'x');
    RAISE EXCEPTION 'FALLO (extraño): comentó un entregable ajeno';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- ---------------------------------------------------------------------
-- 3) anon: nada
-- ---------------------------------------------------------------------
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);

DO $$
DECLARE q text; n bigint;
BEGIN
  FOREACH q IN ARRAY ARRAY[
    'SELECT count(*) FROM public.clients',
    'SELECT count(*) FROM public.client_self',
    'SELECT count(*) FROM public.deliverables',
    'SELECT count(*) FROM public.deliverable_comments',
    'SELECT count(*) FROM public.client_billing',
    'SELECT count(*) FROM public.payments',
    'SELECT count(*) FROM public.portal_payments',
    'SELECT count(*) FROM public.org_members',
    'SELECT count(*) FROM public.client_users',
    'SELECT count(*) FROM public.deliverable_review_links',
    'SELECT count(*) FROM storage.objects WHERE bucket_id = ''client-media'' AND name NOT LIKE ''portfolio/%'''
  ] LOOP
    BEGIN
      EXECUTE q INTO n;
    EXCEPTION WHEN insufficient_privilege THEN n := 0;
    END;
    IF n <> 0 THEN RAISE EXCEPTION 'FALLO (anon): % → % filas', q, n; END IF;
  END LOOP;
  IF has_function_privilege('public.org_meta_get_secret(uuid)', 'EXECUTE')
     OR has_function_privilege('public.org_meta_set_secret(uuid, text, timestamptz, text[])', 'EXECUTE')
     OR has_function_privilege('public.ensure_org()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALLO (anon): puede ejecutar funciones de org/vault';
  END IF;
  IF has_function_privilege('public.client_panel_target(uuid)', 'EXECUTE')
     OR has_function_privilege('public.client_plan_board(uuid)', 'EXECUTE')
     OR has_function_privilege('public.client_files_catalog(uuid)', 'EXECUTE')
     OR has_function_privilege('public.client_contracts_list(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALLO (anon): puede ejecutar las RPC del panel del cliente';
  END IF;
END $$;
RESET ROLE;

-- ---------------------------------------------------------------------
-- 4) Owner de la agencia A: ve a sus dos clientes (control positivo)
-- ---------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000000a1","role":"authenticated"}', true);
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.clients
   WHERE id IN ('00000000-0000-4000-a000-0000000000ca', '00000000-0000-4000-a000-0000000000cb');
  IF n <> 2 THEN RAISE EXCEPTION 'FALLO (agencia): ve % de sus 2 clientes', n; END IF;
  SELECT count(*) INTO n FROM public.clients WHERE id = '00000000-0000-4000-a000-0000000000cc';
  IF n <> 0 THEN RAISE EXCEPTION 'FALLO (agencia): ve el cliente de otra org'; END IF;
  -- Activar el panel de su cliente sí puede (owner = manages_client).
  UPDATE public.client_users SET panel_enabled = true
   WHERE user_id = '00000000-0000-4000-a000-0000000000c1';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FALLO (agencia): no pudo activar el panel de su cliente'; END IF;
  -- Vista previa ("Ver como cliente") de SU cliente: sí; sin preview: nada.
  IF public.client_panel_target('00000000-0000-4000-a000-0000000000ca')
     IS DISTINCT FROM '00000000-0000-4000-a000-0000000000ca' THEN
    RAISE EXCEPTION 'FALLO (agencia): no puede previsualizar a su cliente';
  END IF;
  IF public.client_plan_board() IS NOT NULL THEN
    RAISE EXCEPTION 'FALLO (agencia): client_plan_board sin preview devolvió datos';
  END IF;
  IF (public.client_plan_board('00000000-0000-4000-a000-0000000000ca'))::text NOT LIKE '%TEST tarea A%'
     OR (public.client_plan_board('00000000-0000-4000-a000-0000000000ca'))::text LIKE '%TEST tarea B%' THEN
    RAISE EXCEPTION 'FALLO (agencia): la vista previa de A no es solo de A';
  END IF;
  IF jsonb_array_length(public.client_contracts_list('00000000-0000-4000-a000-0000000000ca')) <> 1 THEN
    RAISE EXCEPTION 'FALLO (agencia): la vista previa de Legal incluye borradores';
  END IF;
  IF public.client_panel_target('00000000-0000-4000-a000-0000000000cc') IS NOT NULL THEN
    RAISE EXCEPTION 'FALLO (agencia): previsualiza un cliente de otra org';
  END IF;
END $$;
RESET ROLE;

-- ---------------------------------------------------------------------
-- 5) Fase 2 · Leads, WhatsApp e Instagram del panel del cliente
--    (migración 20261012002910). RPC client_* fijan el cliente con
--    user_client_id(): A ve solo lo suyo, sin columnas internas; el extraño,
--    la agencia (no es cliente) y anon no ven nada.
-- ---------------------------------------------------------------------
INSERT INTO public.whatsapp_accounts (id, client_id, connected, display_phone_number, ai_system_prompt) VALUES
  ('00000000-0000-4000-a000-0000000001a0', '00000000-0000-4000-a000-0000000000ca', true, '+56 9 1111 1111', 'PROMPT SECRETO A'),
  ('00000000-0000-4000-a000-0000000001b0', '00000000-0000-4000-a000-0000000000cb', true, '+56 9 2222 2222', 'PROMPT SECRETO B');
INSERT INTO public.whatsapp_conversations (id, client_id, account_id, contact_wa_id, contact_name, is_lead, last_message_at) VALUES
  ('00000000-0000-4000-a000-0000000001a1', '00000000-0000-4000-a000-0000000000ca', '00000000-0000-4000-a000-0000000001a0', '56911110000', 'Lead A', true, now()),
  ('00000000-0000-4000-a000-0000000001b1', '00000000-0000-4000-a000-0000000000cb', '00000000-0000-4000-a000-0000000001b0', '56922220000', 'Lead B', true, now());
INSERT INTO public.whatsapp_messages (conversation_id, client_id, direction, body) VALUES
  ('00000000-0000-4000-a000-0000000001a1', '00000000-0000-4000-a000-0000000000ca', 'inbound', 'hola A'),
  ('00000000-0000-4000-a000-0000000001b1', '00000000-0000-4000-a000-0000000000cb', 'inbound', 'hola B');
INSERT INTO public.client_leads (client_id, source, name, contact, metadata) VALUES
  ('00000000-0000-4000-a000-0000000000ca', 'meta_ads', 'TEST lead A', 'a@example.invalid', '{"interno":"A"}'),
  ('00000000-0000-4000-a000-0000000000cb', 'meta_ads', 'TEST lead B', 'b@example.invalid', '{"interno":"B"}');
INSERT INTO public.lead_meta (client_id, source, source_id, status, notes) VALUES
  ('00000000-0000-4000-a000-0000000000ca', 'whatsapp', '00000000-0000-4000-a000-0000000001a1', 'contacted', 'NOTA INTERNA LEAD A');
INSERT INTO public.instagram_posts (client_id, type, position, caption, approval_status, approval_note) VALUES
  ('00000000-0000-4000-a000-0000000000ca', 'proposed', 0, 'TEST post A', 'pendiente', 'NOTA APROBACION A'),
  ('00000000-0000-4000-a000-0000000000ca', 'proposed', 1, 'TEST borrador A', NULL, NULL),
  ('00000000-0000-4000-a000-0000000000cb', 'proposed', 0, 'TEST post B', 'pendiente', NULL);
-- Un client_lead que repite la conversación de WhatsApp de A no se cuenta dos veces.
INSERT INTO public.client_leads (client_id, source, name, contact, conversation_id) VALUES
  ('00000000-0000-4000-a000-0000000000ca', 'whatsapp', 'Lead A', '56911110000', '00000000-0000-4000-a000-0000000001a1');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}', true);
DO $$
DECLARE n bigint; j jsonb; t text;
BEGIN
  -- Leads: los 2 de A (WhatsApp + Meta Ads), con estado y sin notas internas.
  SELECT count(*) INTO n FROM public.client_leads_page(50, 0);
  IF n <> 2 THEN RAISE EXCEPTION 'FALLO (fase 2, cliente A): client_leads_page → % filas', n; END IF;
  SELECT count(*) INTO n FROM public.client_leads_page(50, 0)
   WHERE name LIKE '%B' OR contact LIKE '%2222%' OR contact LIKE 'b@%';
  IF n <> 0 THEN RAISE EXCEPTION 'FALLO (fase 2, cliente A): ve leads de B'; END IF;
  SELECT status INTO t FROM public.client_leads_page(50, 0) WHERE source = 'whatsapp';
  IF t IS DISTINCT FROM 'contacted' THEN RAISE EXCEPTION 'FALLO (fase 2, cliente A): estado del lead = %', t; END IF;
  SELECT string_agg(r::text, ' ') INTO t FROM public.client_leads_page(50, 0) r;
  IF t LIKE '%NOTA INTERNA%' OR t LIKE '%interno%' THEN
    RAISE EXCEPTION 'FALLO (fase 2, cliente A): client_leads_page expone notas/metadatos';
  END IF;
  SELECT count(*) INTO n FROM public.client_leads_page(1, 0);
  IF n <> 1 THEN RAISE EXCEPTION 'FALLO (fase 2): client_leads_page no pagina'; END IF;

  -- WhatsApp: su línea, su conversación y sus mensajes; nunca el prompt.
  SELECT count(*) INTO n FROM public.client_whatsapp_status() WHERE connected;
  IF n <> 1 THEN RAISE EXCEPTION 'FALLO (fase 2, cliente A): client_whatsapp_status → %', n; END IF;
  SELECT string_agg(r::text, ' ') INTO t FROM public.client_whatsapp_status() r;
  IF t LIKE '%PROMPT%' OR t LIKE '%2222%' THEN
    RAISE EXCEPTION 'FALLO (fase 2, cliente A): client_whatsapp_status expone datos ajenos/internos';
  END IF;
  SELECT count(*) INTO n FROM public.client_whatsapp_conversations(50, 0);
  IF n <> 1 THEN RAISE EXCEPTION 'FALLO (fase 2, cliente A): ve % conversaciones', n; END IF;
  SELECT count(*) INTO n FROM public.client_whatsapp_messages('00000000-0000-4000-a000-0000000001a1');
  IF n <> 1 THEN RAISE EXCEPTION 'FALLO (fase 2, cliente A): no ve sus mensajes (%)', n; END IF;
  SELECT count(*) INTO n FROM public.client_whatsapp_messages('00000000-0000-4000-a000-0000000001b1');
  IF n <> 0 THEN RAISE EXCEPTION 'FALLO (fase 2, cliente A): lee mensajes de B por id'; END IF;

  -- Con _preview de otro cliente sigue viendo SOLO lo suyo.
  SELECT count(*) INTO n FROM public.client_leads_page(50, 0, '00000000-0000-4000-a000-0000000000cb');
  IF n <> 2 THEN RAISE EXCEPTION 'FALLO (fase 2, cliente A): _preview cambió el cliente (% leads)', n; END IF;
  SELECT count(*) INTO n FROM public.client_whatsapp_messages('00000000-0000-4000-a000-0000000001b1', 40, NULL, NULL, '00000000-0000-4000-a000-0000000000cb');
  IF n <> 0 THEN RAISE EXCEPTION 'FALLO (fase 2, cliente A): leyó mensajes de B con _preview'; END IF;

  -- Instagram: su grilla propuesta enviada a aprobación, sin borradores ni notas.
  j := public.client_instagram_overview();
  IF jsonb_array_length(j -> 'posts') <> 1 OR j::text LIKE '%TEST post B%' OR j::text LIKE '%borrador%' THEN
    RAISE EXCEPTION 'FALLO (fase 2, cliente A): client_instagram_overview posts = %', j -> 'posts';
  END IF;
  IF j::text LIKE '%NOTA APROBACION%' OR j::text LIKE '%approval_note%' THEN
    RAISE EXCEPTION 'FALLO (fase 2, cliente A): client_instagram_overview expone notas';
  END IF;

  -- Las tablas base siguen cerradas al cliente.
  FOREACH t IN ARRAY ARRAY[
    'SELECT count(*) FROM public.whatsapp_conversations',
    'SELECT count(*) FROM public.whatsapp_messages',
    'SELECT count(*) FROM public.whatsapp_accounts',
    'SELECT count(*) FROM public.client_leads',
    'SELECT count(*) FROM public.instagram_posts'
  ] LOOP
    BEGIN
      EXECUTE t INTO n;
    EXCEPTION WHEN insufficient_privilege THEN n := 0;
    END;
    IF n <> 0 THEN RAISE EXCEPTION 'FALLO (fase 2, cliente A): % → % filas', t, n; END IF;
  END LOOP;
END $$;
RESET ROLE;

-- Extraño (otra org) y owner de la agencia sin vista previa: nada. El extraño
-- tampoco con _preview = cliente A (no es miembro de esa org).
DO $$
DECLARE who text; pv uuid; n bigint;
BEGIN
  FOREACH who IN ARRAY ARRAY['00000000-0000-4000-a000-0000000000e1', '00000000-0000-4000-a000-0000000000a1'] LOOP
    pv := CASE WHEN who LIKE '%e1' THEN '00000000-0000-4000-a000-0000000000ca'::uuid ELSE NULL END;
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', who, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT (SELECT count(*) FROM public.client_leads_page(50, 0, pv))
         + (SELECT count(*) FROM public.client_whatsapp_status(pv))
         + (SELECT count(*) FROM public.client_whatsapp_conversations(50, 0, pv))
         + (SELECT count(*) FROM public.client_whatsapp_messages('00000000-0000-4000-a000-0000000001a1', 40, NULL, NULL, pv))
         + (CASE WHEN public.client_instagram_overview(pv) IS NULL THEN 0 ELSE 1 END)
      INTO n;
    RESET ROLE;
    IF n <> 0 THEN RAISE EXCEPTION 'FALLO (fase 2, %): RPC client_* devolvieron % filas', who, n; END IF;
  END LOOP;
END $$;

-- Owner de la agencia con vista previa: ve SU cliente A, nunca el cliente de otra org.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000000a1","role":"authenticated"}', true);
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.client_leads_page(50, 0, '00000000-0000-4000-a000-0000000000ca');
  IF n <> 2 THEN RAISE EXCEPTION 'FALLO (fase 2, agencia): vista previa de A → % leads', n; END IF;
  SELECT count(*) INTO n FROM public.client_whatsapp_messages('00000000-0000-4000-a000-0000000001a1', 40, NULL, NULL, '00000000-0000-4000-a000-0000000000ca');
  IF n <> 1 THEN RAISE EXCEPTION 'FALLO (fase 2, agencia): vista previa de A → % mensajes', n; END IF;
  SELECT count(*) INTO n FROM public.client_leads_page(50, 0, '00000000-0000-4000-a000-0000000000cc');
  IF n <> 0 THEN RAISE EXCEPTION 'FALLO (fase 2, agencia): vista previa de un cliente ajeno'; END IF;
  IF public.client_instagram_overview('00000000-0000-4000-a000-0000000000cc') IS NOT NULL THEN
    RAISE EXCEPTION 'FALLO (fase 2, agencia): Instagram de un cliente ajeno';
  END IF;
END $$;
RESET ROLE;

-- anon: sin EXECUTE.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.client_leads_page(integer, integer, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.client_whatsapp_status(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.client_whatsapp_conversations(integer, integer, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.client_whatsapp_messages(uuid, integer, timestamptz, uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.client_instagram_overview(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALLO (fase 2, anon): puede ejecutar RPC client_*';
  END IF;
END $$;

SELECT 'aislamiento: OK' AS resultado;
ROLLBACK;
