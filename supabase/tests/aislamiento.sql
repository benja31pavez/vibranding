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
-- 20261012002920 (panel: sitio y publicidad) aplicadas.
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
-- 5) Fase 2 · Sitio y publicidad (client_site_summary, client_meta_ads_summary,
--    client_google_ads_summary): el cliente A solo ve lo suyo, sin ids de
--    cuenta; extraño, agencia y anon no obtienen nada.
-- ---------------------------------------------------------------------
INSERT INTO public.multilinks (id, client_id, slug, title, published) VALUES
  ('00000000-0000-4000-a000-0000000001a1', '00000000-0000-4000-a000-0000000000ca', 'test-ml-a', 'TEST ML A', true),
  ('00000000-0000-4000-a000-0000000001b1', '00000000-0000-4000-a000-0000000000cb', 'test-ml-b', 'TEST ML B', true);
INSERT INTO public.landing_events (event_name, source_type, source_id, client_id, user_agent) VALUES
  ('page_view', 'multilink', '00000000-0000-4000-a000-0000000001a1', '00000000-0000-4000-a000-0000000000ca', 'Mozilla/5.0 (iPhone) Safari/604.1'),
  ('link_click', 'multilink', '00000000-0000-4000-a000-0000000001a1', '00000000-0000-4000-a000-0000000000ca', 'Mozilla/5.0 (iPhone) Safari/604.1'),
  ('page_view', 'multilink', '00000000-0000-4000-a000-0000000001a1', '00000000-0000-4000-a000-0000000000ca', 'Googlebot/2.1'),
  ('page_view', 'multilink', '00000000-0000-4000-a000-0000000001b1', '00000000-0000-4000-a000-0000000000cb', 'Mozilla/5.0 (iPhone) Safari/604.1'),
  ('page_view', 'multilink', '00000000-0000-4000-a000-0000000001b1', '00000000-0000-4000-a000-0000000000cb', 'Mozilla/5.0 (iPhone) Safari/604.1');
INSERT INTO public.meta_accounts (client_id, ad_account_id, connected, currency) VALUES
  ('00000000-0000-4000-a000-0000000000ca', '111111111', true, 'CLP'),
  ('00000000-0000-4000-a000-0000000000cb', '222222222', true, 'CLP');
INSERT INTO public.ad_insights_daily (client_id, date, level, entity_id, campaign_id, campaign_name, spend, impressions, reach, clicks, messaging_conversations_started) VALUES
  ('00000000-0000-4000-a000-0000000000ca', (now() AT TIME ZONE 'America/Santiago')::date, 'ad', 'ad-a', 'cmp-a', 'TEST campaña A', 10000, 1000, 800, 50, 5),
  ('00000000-0000-4000-a000-0000000000cb', (now() AT TIME ZONE 'America/Santiago')::date, 'ad', 'ad-b', 'cmp-b', 'TEST campaña B', 99999, 9999, 9999, 999, 99);
INSERT INTO public.google_ads_insights_daily (client_id, customer_id, date, campaign_id, campaign_name, impressions, clicks, cost_clp, conversions) VALUES
  ('00000000-0000-4000-a000-0000000000cb', '2222222222', (now() AT TIME ZONE 'America/Santiago')::date, 'g-b', 'TEST google B', 100, 10, 5000, 1);

-- Cliente A
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}', true);
DO $$
DECLARE site jsonb; meta jsonb; g jsonb;
BEGIN
  site := public.client_site_summary(30);
  IF site->'multilink'->>'slug' IS DISTINCT FROM 'test-ml-a' THEN
    RAISE EXCEPTION 'FALLO (cliente A): client_site_summary no devolvió su multienlace: %', site;
  END IF;
  -- 1 visita real (el bot no cuenta) y 1 clic; nada del multienlace de B.
  IF (site->'multilink_metrics'->>'views')::int <> 1 OR (site->'multilink_metrics'->>'clicks')::int <> 1 THEN
    RAISE EXCEPTION 'FALLO (cliente A): métricas del sitio incorrectas: %', site->'multilink_metrics';
  END IF;
  IF site::text ILIKE '%test-ml-b%' THEN RAISE EXCEPTION 'FALLO (cliente A): vio el sitio de B'; END IF;

  meta := public.client_meta_ads_summary(30);
  IF (meta->>'connected')::boolean IS NOT TRUE OR (meta->'totals'->>'spend')::numeric <> 10000 THEN
    RAISE EXCEPTION 'FALLO (cliente A): resumen de Meta incorrecto: %', meta;
  END IF;
  IF meta::text ILIKE '%campaña B%' OR meta::text LIKE '%111111111%' OR meta::text LIKE '%222222222%'
     OR meta::text ILIKE '%token%' THEN
    RAISE EXCEPTION 'FALLO (cliente A): el resumen de Meta expone datos de B o ids de cuenta: %', meta;
  END IF;

  g := public.client_google_ads_summary(30);
  IF (g->>'connected')::boolean IS NOT FALSE OR g::text ILIKE '%google B%' THEN
    RAISE EXCEPTION 'FALLO (cliente A): resumen de Google incorrecto: %', g;
  END IF;

END $$;
DO $$
DECLARE q text; n bigint;
BEGIN
  -- Sigue sin leer las tablas de ingesta ni de cuentas directamente.
  FOREACH q IN ARRAY ARRAY[
    'SELECT count(*) FROM public.ad_insights_daily',
    'SELECT count(*) FROM public.landing_events',
    'SELECT count(*) FROM public.google_ads_insights_daily',
    'SELECT count(*) FROM public.google_ads_accounts',
    'SELECT count(*) FROM public.meta_billing_status',
    'SELECT count(*) FROM public.multilinks WHERE NOT published'
  ] LOOP
    BEGIN
      EXECUTE q INTO n;
    EXCEPTION WHEN insufficient_privilege THEN n := 0;
    END;
    IF n <> 0 THEN RAISE EXCEPTION 'FALLO (cliente A): % → % filas', q, n; END IF;
  END LOOP;
END $$;
RESET ROLE;

-- Extraño (owner de otra org) y owner de la agencia: los RPC devuelven NULL.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000000e1","role":"authenticated"}', true);
DO $$
BEGIN
  IF public.client_site_summary(30) IS NOT NULL
     OR public.client_meta_ads_summary(30) IS NOT NULL
     OR public.client_google_ads_summary(30) IS NOT NULL THEN
    RAISE EXCEPTION 'FALLO (extraño): un RPC del panel del cliente devolvió datos';
  END IF;
END $$;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-a000-0000000000a1","role":"authenticated"}', true);
DO $$
BEGIN
  IF public.client_site_summary(30) IS NOT NULL
     OR public.client_meta_ads_summary(30) IS NOT NULL
     OR public.client_google_ads_summary(30) IS NOT NULL THEN
    RAISE EXCEPTION 'FALLO (agencia): un RPC del panel del cliente devolvió datos';
  END IF;
END $$;
RESET ROLE;

-- anon: sin EXECUTE.
SET LOCAL ROLE anon;
DO $$
BEGIN
  IF has_function_privilege('public.client_site_summary(integer)', 'EXECUTE')
     OR has_function_privilege('public.client_meta_ads_summary(integer)', 'EXECUTE')
     OR has_function_privilege('public.client_google_ads_summary(integer)', 'EXECUTE')
     OR has_function_privilege('public.analytics_is_bot_ua(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FALLO (anon): puede ejecutar RPC del panel del cliente';
  END IF;
END $$;
RESET ROLE;

SELECT 'aislamiento: OK' AS resultado;
ROLLBACK;
