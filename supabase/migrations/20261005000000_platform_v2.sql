-- lovable-cron-fallback-reviewed: 1 run/day; mark_overdue_payments() es SQL puro (sin HTTP) y solo cambia pending -> overdue una vez al día; no hay evento que lo dispare, el vencimiento depende solo del calendario
-- =====================================================================
-- VIBRANDING · Plataforma v2 · migración única
-- =====================================================================
-- Qué hace (resumen):
--   1. clients: estado comercial (status, plan_key, mrr, billing_day,
--      onboarding_token, started_at).
--   2. payments: moneda por defecto CLP (solo el DEFAULT, no toca datos;
--      igual en client_contracts y pricing_settings), document_type
--      (factura|boleta), kind, period, provider, provider_ref, flow_token,
--      payment_url, subscription_id. El portal del cliente lee sus cobros.
--      service_pricing acepta además las claves marca-web|contenido|crecimiento.
--   3. instagram_posts: approval_status, approved_at, approved_by.
--   4. Tablas nuevas: subscriptions, prospects, proposals, monthly_reports,
--      campaign_alerts, google_ads_accounts, google_ads_insights_daily.
--      Todas con RLS: miembros de la org leen; can_edit_client() /
--      can_edit_org() (owner/admin/agent) escriben; owner/admin borran.
--   5. Accesos públicos por token SIN abrir SELECT a anon: funciones
--      SECURITY DEFINER get_proposal_by_token, accept_proposal,
--      get_monthly_report_by_token, get_onboarding_by_token.
--   6. Vista approval_queue (security_invoker) con entregables en revisión,
--      posts de Instagram pendientes y propuestas en borrador.
--   7. mark_overdue_payments() + cron diario (pg_cron ya se usa en el
--      proyecto: whatsapp_ai_dispatch, meta_insights_daily).
--
-- Cómo se aplica: UNA sola vez, vía Lovable (prompt "aplica la migración
-- supabase/migrations/20261005000000_platform_v2.sql tal cual") o pegándola
-- completa en el SQL editor de Supabase. Es idempotente (IF NOT EXISTS,
-- CREATE OR REPLACE, DROP ... IF EXISTS antes de cada policy/trigger), así
-- que re-ejecutarla no rompe nada, pero no hace falta.
--
-- Compatibilidad: define can_edit_client(_client_id uuid) con la misma
-- firma y semántica que 20261004200000_security_hardening.sql
-- (miembro owner/admin/agent de la org del cliente). Si ese archivo ya se
-- aplicó, el CREATE OR REPLACE de aquí lo deja igual.
-- =====================================================================


-- =====================================================================
-- 0. Helpers de autorización
-- =====================================================================

-- ¿El usuario actual puede editar este cliente? (owner/admin/agent de su org)
CREATE OR REPLACE FUNCTION public.can_edit_client(_client_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.org_members m ON m.org_id = c.org_id
    WHERE c.id = _client_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'agent')
  )
$$;

-- ¿El usuario actual puede editar datos a nivel org? (owner/admin/agent)
CREATE OR REPLACE FUNCTION public.can_edit_org(_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = _org_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin', 'agent')
  )
$$;

REVOKE ALL ON FUNCTION public.can_edit_client(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_org(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_client(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_org(uuid) TO authenticated, service_role;

-- Trigger genérico: si la fila trae client_id, debe pertenecer a la misma org.
CREATE OR REPLACE FUNCTION public.enforce_client_in_org()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'client_id % no pertenece a la org %', NEW.client_id, NEW.org_id;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.enforce_client_in_org() FROM PUBLIC, anon, authenticated;


-- =====================================================================
-- 1. clients: estado comercial
-- =====================================================================
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'activo',
  ADD COLUMN IF NOT EXISTS plan_key text,
  ADD COLUMN IF NOT EXISTS mrr integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_day smallint,
  ADD COLUMN IF NOT EXISTS onboarding_token text,
  ADD COLUMN IF NOT EXISTS started_at date;

COMMENT ON COLUMN public.clients.mrr IS 'Ingreso mensual recurrente en CLP (entero, sin decimales).';
COMMENT ON COLUMN public.clients.billing_day IS 'Día del mes en que se cobra (1..28).';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_status_chk' AND conrelid = 'public.clients'::regclass) THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_status_chk
      CHECK (status IN ('prospecto', 'onboarding', 'activo', 'pausado', 'terminado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_plan_key_chk' AND conrelid = 'public.clients'::regclass) THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_plan_key_chk
      CHECK (plan_key IS NULL OR plan_key IN ('marca-web', 'contenido', 'crecimiento'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_mrr_chk' AND conrelid = 'public.clients'::regclass) THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_mrr_chk CHECK (mrr >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_billing_day_chk' AND conrelid = 'public.clients'::regclass) THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_billing_day_chk
      CHECK (billing_day IS NULL OR billing_day BETWEEN 1 AND 28);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_onboarding_token_chk' AND conrelid = 'public.clients'::regclass) THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_onboarding_token_chk
      CHECK (onboarding_token IS NULL OR length(onboarding_token) >= 24);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS clients_onboarding_token_uk
  ON public.clients (onboarding_token) WHERE onboarding_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS clients_org_status_idx ON public.clients (org_id, status);


-- =====================================================================
-- 2. subscriptions (cobro recurrente) — antes que payments.subscription_id
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_key text NOT NULL,
  amount_clp integer NOT NULL DEFAULT 0,
  "interval" text NOT NULL DEFAULT 'month',
  status text NOT NULL DEFAULT 'pendiente',
  next_charge_date date,
  provider text NOT NULL DEFAULT 'manual',
  provider_ref text,
  min_months smallint NOT NULL DEFAULT 0,
  started_at date,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_plan_key_chk CHECK (plan_key IN ('marca-web', 'contenido', 'crecimiento')),
  CONSTRAINT subscriptions_amount_chk CHECK (amount_clp >= 0),
  CONSTRAINT subscriptions_interval_chk CHECK ("interval" IN ('month')),
  CONSTRAINT subscriptions_status_chk CHECK (status IN ('pendiente', 'activa', 'pausada', 'cancelada')),
  CONSTRAINT subscriptions_provider_chk CHECK (provider IN ('flow', 'mercadopago', 'manual')),
  CONSTRAINT subscriptions_min_months_chk CHECK (min_months >= 0)
);

CREATE INDEX IF NOT EXISTS subscriptions_client_idx ON public.subscriptions (client_id);
CREATE INDEX IF NOT EXISTS subscriptions_due_idx
  ON public.subscriptions (next_charge_date) WHERE status = 'activa';
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_ref_uk
  ON public.subscriptions (provider, provider_ref) WHERE provider_ref IS NOT NULL;

REVOKE ALL ON public.subscriptions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions select" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions insert" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions update" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions delete" ON public.subscriptions;
CREATE POLICY "subscriptions select" ON public.subscriptions FOR SELECT TO authenticated
  USING (public.owns_client(client_id) OR client_id = public.user_client_id());
CREATE POLICY "subscriptions insert" ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_client(client_id));
CREATE POLICY "subscriptions update" ON public.subscriptions FOR UPDATE TO authenticated
  USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));
CREATE POLICY "subscriptions delete" ON public.subscriptions FOR DELETE TO authenticated
  USING (public.manages_client(client_id));

DROP TRIGGER IF EXISTS t_subscriptions_u ON public.subscriptions;
CREATE TRIGGER t_subscriptions_u BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- =====================================================================
-- 3. payments: CLP + cobro con link
-- =====================================================================
-- Solo cambia el DEFAULT para filas nuevas; las filas existentes conservan su moneda.
ALTER TABLE public.payments ALTER COLUMN currency SET DEFAULT 'CLP';
ALTER TABLE public.client_contracts ALTER COLUMN currency SET DEFAULT 'CLP';
ALTER TABLE public.pricing_settings ALTER COLUMN currency SET DEFAULT 'CLP';

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS document_type text,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS period date,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_ref text,
  ADD COLUMN IF NOT EXISTS flow_token text,
  ADD COLUMN IF NOT EXISTS payment_url text,
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  -- ya existen desde la migración inicial; se dejan por si acaso (no-op)
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS paid_at date;

COMMENT ON COLUMN public.payments.period IS 'Mes que cubre el cobro (siempre el día 1 del mes).';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_document_type_chk' AND conrelid = 'public.payments'::regclass) THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_document_type_chk
      CHECK (document_type IS NULL OR document_type IN ('factura', 'boleta'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_kind_chk' AND conrelid = 'public.payments'::regclass) THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_kind_chk
      CHECK (kind IS NULL OR kind IN ('unico', 'mensual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_period_chk' AND conrelid = 'public.payments'::regclass) THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_period_chk
      CHECK (period IS NULL OR period = date_trunc('month', period)::date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_provider_chk' AND conrelid = 'public.payments'::regclass) THEN
    ALTER TABLE public.payments ADD CONSTRAINT payments_provider_chk
      CHECK (provider IS NULL OR provider IN ('flow', 'mercadopago', 'manual'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS payments_flow_token_uk
  ON public.payments (flow_token) WHERE flow_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_ref_uk
  ON public.payments (provider, provider_ref) WHERE provider_ref IS NOT NULL;
-- Un solo cobro por suscripción y mes (idempotencia del cron de cobro recurrente)
CREATE UNIQUE INDEX IF NOT EXISTS payments_subscription_period_uk
  ON public.payments (subscription_id, period) WHERE subscription_id IS NOT NULL AND period IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_client_idx ON public.payments (client_id, due_date DESC);
CREATE INDEX IF NOT EXISTS payments_pending_due_idx
  ON public.payments (due_date) WHERE status = 'pending';

-- El usuario del portal ve los cobros de su cliente (para pagar con payment_url).
DROP POLICY IF EXISTS "client user reads payments" ON public.payments;
CREATE POLICY "client user reads payments" ON public.payments FOR SELECT TO authenticated
  USING (client_id = public.user_client_id());


-- =====================================================================
-- 3b. service_pricing: acepta las claves de los planes v2 (src/lib/pricing/plans.ts)
--     sin quitar las 6 antiguas. El CHECK original era inline (sin nombre),
--     así que se busca por definición y se reemplaza por uno con nombre.
-- =====================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.service_pricing'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%service_key%'
      AND conname <> 'service_pricing_service_key_chk'
  LOOP
    EXECUTE format('ALTER TABLE public.service_pricing DROP CONSTRAINT %I', r.conname);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_pricing_service_key_chk' AND conrelid = 'public.service_pricing'::regclass) THEN
    ALTER TABLE public.service_pricing ADD CONSTRAINT service_pricing_service_key_chk
      CHECK (service_key IN ('branding', 'optimization', 'content', 'ads', 'landing', 'chatbot',
                             'marca-web', 'contenido', 'crecimiento'));
  END IF;
END $$;


-- =====================================================================
-- 4. instagram_posts: aprobación
-- =====================================================================
ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS approval_status text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instagram_posts_approval_status_chk' AND conrelid = 'public.instagram_posts'::regclass) THEN
    ALTER TABLE public.instagram_posts ADD CONSTRAINT instagram_posts_approval_status_chk
      CHECK (approval_status IS NULL OR approval_status IN ('pendiente', 'aprobado', 'cambios', 'rechazado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS instagram_posts_approval_pending_idx
  ON public.instagram_posts (client_id) WHERE approval_status = 'pendiente';


-- =====================================================================
-- 5. prospects (pipeline comercial)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  rubro text,
  comuna text,
  web text,
  instagram text,
  email_publico text,
  telefono_publico text,
  fuente text NOT NULL,
  estado text NOT NULL DEFAULT 'nuevo',
  producto_sugerido text,
  notas text,
  ultimo_contacto timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospects_nombre_chk CHECK (btrim(nombre) <> ''),
  -- Origen del dato obligatorio (trazabilidad de datos personales).
  CONSTRAINT prospects_fuente_chk CHECK (btrim(fuente) <> ''),
  CONSTRAINT prospects_estado_chk CHECK (estado IN
    ('nuevo', 'contactado', 'respondio', 'demo', 'propuesta', 'ganado', 'perdido', 'baja'))
);

CREATE INDEX IF NOT EXISTS prospects_org_estado_idx ON public.prospects (org_id, estado);
CREATE INDEX IF NOT EXISTS prospects_org_created_idx ON public.prospects (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS prospects_org_instagram_idx ON public.prospects (org_id, lower(instagram))
  WHERE instagram IS NOT NULL;

REVOKE ALL ON public.prospects FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO authenticated;
GRANT ALL ON public.prospects TO service_role;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospects select" ON public.prospects;
DROP POLICY IF EXISTS "prospects insert" ON public.prospects;
DROP POLICY IF EXISTS "prospects update" ON public.prospects;
DROP POLICY IF EXISTS "prospects delete" ON public.prospects;
CREATE POLICY "prospects select" ON public.prospects FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "prospects insert" ON public.prospects FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_org(org_id));
CREATE POLICY "prospects update" ON public.prospects FOR UPDATE TO authenticated
  USING (public.can_edit_org(org_id)) WITH CHECK (public.can_edit_org(org_id));
CREATE POLICY "prospects delete" ON public.prospects FOR DELETE TO authenticated
  USING (public.is_org_manager(org_id));

DROP TRIGGER IF EXISTS t_prospects_u ON public.prospects;
CREATE TRIGGER t_prospects_u BEFORE UPDATE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- =====================================================================
-- 6. proposals (propuesta pública con aceptación online)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  token text NOT NULL DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  title text,
  plan_key text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount_clp integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'borrador',
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  accepted_name text,
  accepted_ip_hash text,
  accepted_text text,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposals_token_uk UNIQUE (token),
  CONSTRAINT proposals_token_chk CHECK (length(token) >= 24),
  CONSTRAINT proposals_plan_key_chk CHECK (plan_key IS NULL OR plan_key IN ('marca-web', 'contenido', 'crecimiento')),
  CONSTRAINT proposals_items_chk CHECK (jsonb_typeof(items) = 'array'),
  CONSTRAINT proposals_amount_chk CHECK (amount_clp >= 0),
  CONSTRAINT proposals_status_chk CHECK (status IN
    ('borrador', 'enviada', 'vista', 'aceptada', 'rechazada', 'expirada'))
);

CREATE INDEX IF NOT EXISTS proposals_org_status_idx ON public.proposals (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS proposals_client_idx ON public.proposals (client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS proposals_prospect_idx ON public.proposals (prospect_id) WHERE prospect_id IS NOT NULL;

REVOKE ALL ON public.proposals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proposals select" ON public.proposals;
DROP POLICY IF EXISTS "proposals client user select" ON public.proposals;
DROP POLICY IF EXISTS "proposals insert" ON public.proposals;
DROP POLICY IF EXISTS "proposals update" ON public.proposals;
DROP POLICY IF EXISTS "proposals delete" ON public.proposals;
CREATE POLICY "proposals select" ON public.proposals FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "proposals client user select" ON public.proposals FOR SELECT TO authenticated
  USING (client_id IS NOT NULL AND client_id = public.user_client_id() AND status <> 'borrador');
CREATE POLICY "proposals insert" ON public.proposals FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_org(org_id));
CREATE POLICY "proposals update" ON public.proposals FOR UPDATE TO authenticated
  USING (public.can_edit_org(org_id)) WITH CHECK (public.can_edit_org(org_id));
CREATE POLICY "proposals delete" ON public.proposals FOR DELETE TO authenticated
  USING (public.is_org_manager(org_id));

DROP TRIGGER IF EXISTS t_proposals_u ON public.proposals;
CREATE TRIGGER t_proposals_u BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS t_proposals_client_org ON public.proposals;
CREATE TRIGGER t_proposals_client_org BEFORE INSERT OR UPDATE OF client_id, org_id ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_client_in_org();

-- La aceptación es evidencia: desde el navegador (anon/authenticated) nadie
-- puede escribir accepted_* ni modificar una propuesta ya aceptada.
-- Solo accept_proposal() (SECURITY DEFINER) o service_role pueden hacerlo.
CREATE OR REPLACE FUNCTION public.guard_proposal_acceptance()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'aceptada' OR NEW.accepted_at IS NOT NULL OR NEW.accepted_name IS NOT NULL
       OR NEW.accepted_ip_hash IS NOT NULL OR NEW.accepted_text IS NOT NULL THEN
      RAISE EXCEPTION 'la aceptación solo se registra vía accept_proposal()';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'aceptada' THEN
    RAISE EXCEPTION 'una propuesta aceptada no se puede modificar';
  END IF;

  IF NEW.status = 'aceptada'
     OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
     OR NEW.accepted_name IS DISTINCT FROM OLD.accepted_name
     OR NEW.accepted_ip_hash IS DISTINCT FROM OLD.accepted_ip_hash
     OR NEW.accepted_text IS DISTINCT FROM OLD.accepted_text THEN
    RAISE EXCEPTION 'la aceptación solo se registra vía accept_proposal()';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_proposal_acceptance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_proposals_guard ON public.proposals;
CREATE TRIGGER t_proposals_guard BEFORE INSERT OR UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.guard_proposal_acceptance();


-- =====================================================================
-- 7. monthly_reports
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  period date NOT NULL,
  token text NOT NULL DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_reports_token_uk UNIQUE (token),
  CONSTRAINT monthly_reports_client_period_uk UNIQUE (client_id, period),
  CONSTRAINT monthly_reports_token_chk CHECK (length(token) >= 24),
  CONSTRAINT monthly_reports_period_chk CHECK (period = date_trunc('month', period)::date)
);

CREATE INDEX IF NOT EXISTS monthly_reports_client_period_idx ON public.monthly_reports (client_id, period DESC);

REVOKE ALL ON public.monthly_reports FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_reports TO authenticated;
GRANT ALL ON public.monthly_reports TO service_role;
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_reports select" ON public.monthly_reports;
DROP POLICY IF EXISTS "monthly_reports client user select" ON public.monthly_reports;
DROP POLICY IF EXISTS "monthly_reports insert" ON public.monthly_reports;
DROP POLICY IF EXISTS "monthly_reports update" ON public.monthly_reports;
DROP POLICY IF EXISTS "monthly_reports delete" ON public.monthly_reports;
CREATE POLICY "monthly_reports select" ON public.monthly_reports FOR SELECT TO authenticated
  USING (public.owns_client(client_id));
CREATE POLICY "monthly_reports client user select" ON public.monthly_reports FOR SELECT TO authenticated
  USING (client_id = public.user_client_id() AND sent_at IS NOT NULL);
CREATE POLICY "monthly_reports insert" ON public.monthly_reports FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_client(client_id));
CREATE POLICY "monthly_reports update" ON public.monthly_reports FOR UPDATE TO authenticated
  USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));
CREATE POLICY "monthly_reports delete" ON public.monthly_reports FOR DELETE TO authenticated
  USING (public.manages_client(client_id));

DROP TRIGGER IF EXISTS t_monthly_reports_u ON public.monthly_reports;
CREATE TRIGGER t_monthly_reports_u BEFORE UPDATE ON public.monthly_reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- =====================================================================
-- 8. campaign_alerts
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.campaign_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  platform text NOT NULL,
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Clave opcional para no duplicar la misma alerta abierta (p. ej. 'cpc_alto:<campaign_id>')
  dedupe_key text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_alerts_platform_chk CHECK (platform IN ('meta', 'google')),
  CONSTRAINT campaign_alerts_severity_chk CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX IF NOT EXISTS campaign_alerts_open_idx
  ON public.campaign_alerts (client_id, created_at DESC) WHERE resolved_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS campaign_alerts_open_dedupe_uk
  ON public.campaign_alerts (client_id, dedupe_key) WHERE resolved_at IS NULL AND dedupe_key IS NOT NULL;

REVOKE ALL ON public.campaign_alerts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_alerts TO authenticated;
GRANT ALL ON public.campaign_alerts TO service_role;
ALTER TABLE public.campaign_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaign_alerts select" ON public.campaign_alerts;
DROP POLICY IF EXISTS "campaign_alerts insert" ON public.campaign_alerts;
DROP POLICY IF EXISTS "campaign_alerts update" ON public.campaign_alerts;
DROP POLICY IF EXISTS "campaign_alerts delete" ON public.campaign_alerts;
CREATE POLICY "campaign_alerts select" ON public.campaign_alerts FOR SELECT TO authenticated
  USING (public.owns_client(client_id));
CREATE POLICY "campaign_alerts insert" ON public.campaign_alerts FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_client(client_id));
CREATE POLICY "campaign_alerts update" ON public.campaign_alerts FOR UPDATE TO authenticated
  USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));
CREATE POLICY "campaign_alerts delete" ON public.campaign_alerts FOR DELETE TO authenticated
  USING (public.manages_client(client_id));

DROP TRIGGER IF EXISTS t_campaign_alerts_u ON public.campaign_alerts;
CREATE TRIGGER t_campaign_alerts_u BEFORE UPDATE ON public.campaign_alerts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- =====================================================================
-- 9. google_ads_accounts (token en Vault, nunca en texto plano)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.google_ads_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  manager_customer_id text,
  token_secret_id uuid,
  status text NOT NULL DEFAULT 'pendiente',
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_ads_accounts_client_uk UNIQUE (client_id),
  -- customer_id de Google Ads: 10 dígitos, sin guiones
  CONSTRAINT google_ads_accounts_customer_id_chk CHECK (customer_id ~ '^[0-9]{10}$'),
  CONSTRAINT google_ads_accounts_manager_id_chk CHECK (manager_customer_id IS NULL OR manager_customer_id ~ '^[0-9]{10}$'),
  CONSTRAINT google_ads_accounts_status_chk CHECK (status IN ('pendiente', 'conectada', 'error', 'desconectada'))
);

CREATE INDEX IF NOT EXISTS google_ads_accounts_org_idx ON public.google_ads_accounts (org_id);

REVOKE ALL ON public.google_ads_accounts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_ads_accounts TO authenticated;
GRANT ALL ON public.google_ads_accounts TO service_role;
ALTER TABLE public.google_ads_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_ads_accounts select" ON public.google_ads_accounts;
DROP POLICY IF EXISTS "google_ads_accounts insert" ON public.google_ads_accounts;
DROP POLICY IF EXISTS "google_ads_accounts update" ON public.google_ads_accounts;
DROP POLICY IF EXISTS "google_ads_accounts delete" ON public.google_ads_accounts;
CREATE POLICY "google_ads_accounts select" ON public.google_ads_accounts FOR SELECT TO authenticated
  USING (public.owns_client(client_id));
CREATE POLICY "google_ads_accounts insert" ON public.google_ads_accounts FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_client(client_id));
CREATE POLICY "google_ads_accounts update" ON public.google_ads_accounts FOR UPDATE TO authenticated
  USING (public.can_edit_client(client_id)) WITH CHECK (public.can_edit_client(client_id));
CREATE POLICY "google_ads_accounts delete" ON public.google_ads_accounts FOR DELETE TO authenticated
  USING (public.manages_client(client_id));

DROP TRIGGER IF EXISTS t_google_ads_accounts_u ON public.google_ads_accounts;
CREATE TRIGGER t_google_ads_accounts_u BEFORE UPDATE ON public.google_ads_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS t_google_ads_accounts_client_org ON public.google_ads_accounts;
CREATE TRIGGER t_google_ads_accounts_client_org BEFORE INSERT OR UPDATE OF client_id, org_id ON public.google_ads_accounts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_client_in_org();

-- Desde el navegador no se puede apuntar token_secret_id a un secreto
-- arbitrario (evita usar el token de otra cuenta); solo se puede limpiar.
CREATE OR REPLACE FUNCTION public.guard_google_ads_token_secret()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NEW.token_secret_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.token_secret_id IS DISTINCT FROM OLD.token_secret_id) THEN
    RAISE EXCEPTION 'token_secret_id solo se asigna vía google_ads_set_secret() (servidor)';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_google_ads_token_secret() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_google_ads_accounts_secret_guard ON public.google_ads_accounts;
CREATE TRIGGER t_google_ads_accounts_secret_guard BEFORE INSERT OR UPDATE ON public.google_ads_accounts
  FOR EACH ROW EXECUTE FUNCTION public.guard_google_ads_token_secret();

-- Accesores Vault (solo service_role), mismo patrón que meta_get_secret/meta_set_secret
CREATE OR REPLACE FUNCTION public.google_ads_get_secret(_account_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE sid uuid; val text;
BEGIN
  SELECT token_secret_id INTO sid FROM public.google_ads_accounts WHERE id = _account_id;
  IF sid IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO val FROM vault.decrypted_secrets WHERE id = sid;
  RETURN val;
END $$;

CREATE OR REPLACE FUNCTION public.google_ads_set_secret(_account_id uuid, _secret text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE sid uuid;
BEGIN
  SELECT token_secret_id INTO sid FROM public.google_ads_accounts WHERE id = _account_id;

  IF _secret IS NULL OR btrim(_secret) = '' THEN
    IF sid IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = sid; END IF;
    UPDATE public.google_ads_accounts SET token_secret_id = NULL WHERE id = _account_id;
    RETURN NULL;
  END IF;

  IF sid IS NULL THEN
    sid := vault.create_secret(_secret, 'google_ads_refresh_token_' || _account_id::text, 'Google Ads OAuth refresh token');
    UPDATE public.google_ads_accounts SET token_secret_id = sid WHERE id = _account_id;
  ELSE
    PERFORM vault.update_secret(sid, _secret);
  END IF;
  RETURN sid;
END $$;

REVOKE ALL ON FUNCTION public.google_ads_get_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.google_ads_set_secret(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.google_ads_get_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_ads_set_secret(uuid, text) TO service_role;


-- =====================================================================
-- 10. google_ads_insights_daily (escribe el servidor; la app solo lee)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.google_ads_insights_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  customer_id text NOT NULL,
  date date NOT NULL,
  campaign_id text NOT NULL,
  campaign_name text,
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  cost_clp numeric NOT NULL DEFAULT 0,
  conversions numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_ads_insights_daily_uk UNIQUE (client_id, campaign_id, date)
);

CREATE INDEX IF NOT EXISTS google_ads_insights_daily_client_date_idx
  ON public.google_ads_insights_daily (client_id, date DESC);

REVOKE ALL ON public.google_ads_insights_daily FROM anon, authenticated;
GRANT SELECT ON public.google_ads_insights_daily TO authenticated;
GRANT ALL ON public.google_ads_insights_daily TO service_role;
ALTER TABLE public.google_ads_insights_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "google_ads_insights select" ON public.google_ads_insights_daily;
CREATE POLICY "google_ads_insights select" ON public.google_ads_insights_daily FOR SELECT TO authenticated
  USING (public.owns_client(client_id));

DROP TRIGGER IF EXISTS t_google_ads_insights_daily_u ON public.google_ads_insights_daily;
CREATE TRIGGER t_google_ads_insights_daily_u BEFORE UPDATE ON public.google_ads_insights_daily
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


-- =====================================================================
-- 11. Accesos públicos por token (SECURITY DEFINER, sin SELECT para anon)
-- =====================================================================
-- Tokens < 24 caracteres se rechazan sin consultar (evita sondeo barato).

-- Propuesta pública: devuelve solo lo necesario y marca 'vista' / 'expirada'.
CREATE OR REPLACE FUNCTION public.get_proposal_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE p public.proposals%ROWTYPE; who text; org_name text;
BEGIN
  IF _token IS NULL OR length(_token) < 24 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO p FROM public.proposals WHERE token = _token AND status <> 'borrador';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  IF p.status IN ('enviada', 'vista') AND p.expires_at IS NOT NULL AND p.expires_at <= now() THEN
    UPDATE public.proposals SET status = 'expirada' WHERE id = p.id;
    p.status := 'expirada';
  ELSIF p.status = 'enviada' THEN
    UPDATE public.proposals SET status = 'vista', viewed_at = coalesce(viewed_at, now()) WHERE id = p.id;
    p.status := 'vista';
  END IF;

  SELECT o.name INTO org_name FROM public.orgs o WHERE o.id = p.org_id;
  IF p.client_id IS NOT NULL THEN
    SELECT c.name INTO who FROM public.clients c WHERE c.id = p.client_id;
  ELSIF p.prospect_id IS NOT NULL THEN
    SELECT pr.nombre INTO who FROM public.prospects pr WHERE pr.id = p.prospect_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'proposal', jsonb_build_object(
      'id', p.id,
      'title', p.title,
      'status', p.status,
      'plan_key', p.plan_key,
      'items', p.items,
      'amount_clp', p.amount_clp,
      'expires_at', p.expires_at,
      'sent_at', p.sent_at,
      'accepted_at', p.accepted_at,
      'accepted_name', p.accepted_name,
      'recipient_name', who,
      'agency_name', org_name
    )
  );
END $$;

-- Aceptación online: registra nombre, hash de IP y el texto exacto aceptado.
CREATE OR REPLACE FUNCTION public.accept_proposal(_token text, _name text, _ip_hash text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE p public.proposals%ROWTYPE; nm text; txt text;
BEGIN
  IF _token IS NULL OR length(_token) < 24 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  nm := left(btrim(coalesce(_name, '')), 120);
  IF length(nm) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_required');
  END IF;

  SELECT * INTO p FROM public.proposals WHERE token = _token AND status <> 'borrador' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  IF p.status = 'aceptada' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'accepted_at', p.accepted_at);
  END IF;
  IF p.status NOT IN ('enviada', 'vista') THEN
    RETURN jsonb_build_object('ok', false, 'reason', p.status);
  END IF;
  IF p.expires_at IS NOT NULL AND p.expires_at <= now() THEN
    UPDATE public.proposals SET status = 'expirada' WHERE id = p.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'expirada');
  END IF;

  txt := format(
    'Yo, %s, acepto la propuesta "%s" (plan %s) por un total de %s CLP, con el detalle: %s. Aceptada el %s (America/Santiago).',
    nm,
    coalesce(p.title, 'Propuesta VIBRANDING'),
    coalesce(p.plan_key, 'a medida'),
    p.amount_clp,
    p.items::text,
    to_char(now() AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD HH24:MI:SS')
  );

  UPDATE public.proposals
     SET status = 'aceptada',
         accepted_at = now(),
         accepted_name = nm,
         accepted_ip_hash = left(nullif(btrim(coalesce(_ip_hash, '')), ''), 128),
         accepted_text = txt
   WHERE id = p.id;

  RETURN jsonb_build_object('ok', true, 'already', false, 'accepted_at', now());
END $$;

-- Reporte mensual público (solo reportes ya enviados).
CREATE OR REPLACE FUNCTION public.get_monthly_report_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE r public.monthly_reports%ROWTYPE; cname text;
BEGIN
  IF _token IS NULL OR length(_token) < 24 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO r FROM public.monthly_reports WHERE token = _token AND sent_at IS NOT NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT c.name INTO cname FROM public.clients c WHERE c.id = r.client_id;

  RETURN jsonb_build_object(
    'ok', true,
    'report', jsonb_build_object(
      'client_name', cname,
      'period', r.period,
      'data', r.data,
      'summary', r.summary,
      'sent_at', r.sent_at
    )
  );
END $$;

-- Onboarding por token: solo clientes en etapa prospecto/onboarding.
CREATE OR REPLACE FUNCTION public.get_onboarding_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE c public.clients%ROWTYPE; org_name text;
BEGIN
  IF _token IS NULL OR length(_token) < 24 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT * INTO c FROM public.clients
   WHERE onboarding_token = _token AND status IN ('prospecto', 'onboarding');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  SELECT o.name INTO org_name FROM public.orgs o WHERE o.id = c.org_id;

  RETURN jsonb_build_object(
    'ok', true,
    'client', jsonb_build_object(
      'name', c.name,
      'instagram_handle', c.instagram_handle,
      'business_description', c.business_description,
      'status', c.status,
      'plan_key', c.plan_key,
      'started_at', c.started_at,
      'agency_name', org_name
    )
  );
END $$;

REVOKE ALL ON FUNCTION public.get_proposal_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_proposal(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_monthly_report_by_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_onboarding_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_proposal_by_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_proposal(text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_report_by_token(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_onboarding_by_token(text) TO anon, authenticated, service_role;


-- =====================================================================
-- 12. Vista approval_queue (respeta RLS del usuario: security_invoker)
-- =====================================================================
-- created_at = momento en que el ítem entró a la cola (para entregables se
-- usa updated_at, que es cuando pasó a in_review).
CREATE OR REPLACE VIEW public.approval_queue
WITH (security_invoker = true) AS
SELECT c.org_id,
       d.client_id,
       'entregable'::text AS kind,
       d.id AS ref_id,
       d.title,
       d.updated_at AS created_at,
       ('/clients/' || d.client_id::text || '/deliverables')::text AS url_hint
FROM public.deliverables d
JOIN public.clients c ON c.id = d.client_id
WHERE d.status = 'in_review'
UNION ALL
SELECT c.org_id,
       p.client_id,
       'post_instagram'::text AS kind,
       p.id AS ref_id,
       coalesce(nullif(left(btrim(p.caption), 80), ''), 'Publicación de Instagram') AS title,
       p.updated_at AS created_at,
       ('/clients/' || p.client_id::text || '/instagram')::text AS url_hint
FROM public.instagram_posts p
JOIN public.clients c ON c.id = p.client_id
WHERE p.approval_status = 'pendiente' AND p.archived_at IS NULL
UNION ALL
SELECT pr.org_id,
       pr.client_id,
       'propuesta'::text AS kind,
       pr.id AS ref_id,
       coalesce(nullif(btrim(pr.title), ''), 'Propuesta ' || coalesce(pr.plan_key, 'a medida')) AS title,
       pr.created_at,
       ('/proposals/' || pr.id::text)::text AS url_hint
FROM public.proposals pr
WHERE pr.status = 'borrador';

REVOKE ALL ON public.approval_queue FROM anon;
GRANT SELECT ON public.approval_queue TO authenticated;
GRANT SELECT ON public.approval_queue TO service_role;


-- =====================================================================
-- 13. Cobros vencidos + cron diario
-- =====================================================================
-- Usa el enum real payment_status: 'pending' -> 'overdue'. "Hoy" en hora de Chile.
CREATE OR REPLACE FUNCTION public.mark_overdue_payments()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE n integer;
BEGIN
  UPDATE public.payments
     SET status = 'overdue'
   WHERE status = 'pending'
     AND due_date IS NOT NULL
     AND due_date < (now() AT TIME ZONE 'America/Santiago')::date;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.mark_overdue_payments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_overdue_payments() TO service_role;

-- pg_cron ya está en uso (whatsapp_ai_dispatch, meta_insights_daily).
-- cron.schedule con el mismo nombre actualiza el job: idempotente.
-- 04:10 UTC = ~00:10/01:10 en Chile según horario de verano.
-- Las alertas de campañas (campaign_alerts) se programarán cuando exista su
-- endpoint (PR13), vía public.run_http_cron_job como meta_insights_daily.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('mark_overdue_payments', '10 4 * * *', 'SELECT public.mark_overdue_payments();');
  ELSE
    RAISE NOTICE 'pg_cron no está instalado: ejecutar public.mark_overdue_payments() a mano o programarlo después';
  END IF;
END $$;
