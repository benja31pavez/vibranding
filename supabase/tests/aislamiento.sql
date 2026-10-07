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
-- Requiere las migraciones 20261012002300 … 20261012002340, 20261012002800 y 20261012002910 aplicadas.
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
INSERT INTO public.instagram_posts (client_id, type, position, caption, approval_note) VALUES
  ('00000000-0000-4000-a000-0000000000ca', 'proposed', 0, 'TEST post A', 'NOTA APROBACION A'),
  ('00000000-0000-4000-a000-0000000000cb', 'proposed', 0, 'TEST post B', NULL);

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

  -- Instagram: su grilla propuesta, sin la nota de aprobación.
  j := public.client_instagram_overview();
  IF jsonb_array_length(j -> 'posts') <> 1 OR j::text LIKE '%TEST post B%' THEN
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

-- Extraño (otra org) y owner de la agencia: no son clientes → nada.
DO $$
DECLARE who text; n bigint;
BEGIN
  FOREACH who IN ARRAY ARRAY['00000000-0000-4000-a000-0000000000e1', '00000000-0000-4000-a000-0000000000a1'] LOOP
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', who, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT (SELECT count(*) FROM public.client_leads_page(50, 0))
         + (SELECT count(*) FROM public.client_whatsapp_status())
         + (SELECT count(*) FROM public.client_whatsapp_conversations(50, 0))
         + (SELECT count(*) FROM public.client_whatsapp_messages('00000000-0000-4000-a000-0000000001a1'))
         + (CASE WHEN public.client_instagram_overview() IS NULL THEN 0 ELSE 1 END)
      INTO n;
    RESET ROLE;
    IF n <> 0 THEN RAISE EXCEPTION 'FALLO (fase 2, %): RPC client_* devolvieron % filas', who, n; END IF;
  END LOOP;
END $$;

-- anon: sin EXECUTE.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.client_leads_page(integer, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.client_whatsapp_status()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.client_whatsapp_conversations(integer, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.client_whatsapp_messages(uuid, integer, timestamptz)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.client_instagram_overview()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALLO (fase 2, anon): puede ejecutar RPC client_*';
  END IF;
END $$;

SELECT 'aislamiento: OK' AS resultado;
ROLLBACK;
