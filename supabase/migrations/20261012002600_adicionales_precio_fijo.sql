-- Adicionales con precio fijo (decisión de Benja, 2026-10-06). Netos en CLP + IVA 19 %.
--
--  - Chatbot WhatsApp: $99.990 + IVA pago único (configuración) + $29.990 + IVA
--    al mes (mantención). La mantención se cobra junto con cada pago del plan
--    mensual mientras el chatbot esté activo. Solo con un plan mensual vigente.
--  - Landing extra: $59.990 + IVA pago único.
--
-- El cliente (o la agencia desde su panel) los contrata en Facturación con Flow.
-- El servidor calcula el monto (src/lib/pricing/addons.ts) y guarda el desglose
-- en payments.items. Los cobros de adicionales llevan addon_key (plan_key NULL),
-- así que NO generan período de membresía ni pasan por set_membership_period.
-- El chatbot queda contratado en client_addons al confirmarse su pago por Flow, y
-- su mensualidad se suma al MRR neto (client_billing.mrr) en sync_client_membership
-- mientras haya plan mensual vigente. Sin plan vigente queda "Suspendido" (no se
-- cobra ni opera); al renovar vuelve a Activo sin pagar de nuevo la configuración.
--
-- APLICAR ANTES de publicar el código (el código nuevo lee/escribe estas columnas).
-- Es aditiva: el código actual sigue funcionando con ella aplicada.
--
-- Espejo en TypeScript: src/lib/pricing/addons.ts y src/lib/billing/addons.ts
-- (npm run check:membership compara precios y la fórmula del MRR).

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 1) Columnas de payments --------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS addon_key text,
  ADD COLUMN IF NOT EXISTS items jsonb;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_addon_key_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_addon_key_check CHECK (
  addon_key IS NULL OR addon_key IN ('chatbot', 'landing')
);
-- Un cobro es de un plan O de un adicional, nunca de ambos.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_plan_or_addon_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_plan_or_addon_check CHECK (
  plan_key IS NULL OR addon_key IS NULL
);
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_items_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_items_check CHECK (
  items IS NULL OR jsonb_typeof(items) = 'array'
);

COMMENT ON COLUMN public.payments.addon_key IS
  'Adicional que paga este cobro (pago único). Solo lo escribe el servidor.';
COMMENT ON COLUMN public.payments.items IS
  'Desglose del cobro: [{type, key, label, net, amount, billing}], amount con IVA. Lo escribe el servidor.';

REVOKE INSERT (addon_key, items), UPDATE (addon_key, items)
  ON public.payments FROM anon, authenticated;

-- Un solo cobro abierto por cliente y adicional (evita duplicados por doble clic;
-- un cobro abandonado de la landing no bloquea el del chatbot).
CREATE UNIQUE INDEX IF NOT EXISTS payments_open_addon_checkout_uk
  ON public.payments (client_id, addon_key)
  WHERE addon_key IS NOT NULL AND proposal_id IS NULL AND status IN ('pending', 'overdue');

-- 2) Precios (NETOS, CLP). Deben coincidir con src/lib/pricing/addons.ts ------------
CREATE OR REPLACE FUNCTION public.addon_setup_net_price(_addon_key text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE _addon_key
    WHEN 'chatbot' THEN 99990
    WHEN 'landing' THEN 59990
  END
$$;

CREATE OR REPLACE FUNCTION public.addon_monthly_net_price(_addon_key text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE _addon_key
    WHEN 'chatbot' THEN 29990
    ELSE 0
  END
$$;

-- 3) Adicionales activos con mantención mensual ----------------------------------
CREATE TABLE IF NOT EXISTS public.client_addons (
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  addon_key text NOT NULL CHECK (addon_key IN ('chatbot')),
  active boolean NOT NULL DEFAULT true,
  activated_at date NOT NULL,
  deactivated_at date,
  setup_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, addon_key)
);

COMMENT ON TABLE public.client_addons IS
  'Adicionales con mensualidad (chatbot). active = contratado (se activa al confirmarse su pago por Flow; la baja la hace el servidor). Estado derivado: Activo con plan mensual vigente; Suspendido sin él (no se cobra ni opera) hasta que el cliente renueve, sin volver a pagar la configuración.';

ALTER TABLE public.client_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_addons select" ON public.client_addons;
CREATE POLICY "client_addons select" ON public.client_addons
  FOR SELECT TO authenticated
  USING (public.owns_client(client_id) OR client_id = public.user_client_id());
-- Solo triggers y service_role escriben.
REVOKE ALL ON public.client_addons FROM anon, authenticated;
GRANT SELECT ON public.client_addons TO authenticated;
GRANT ALL ON public.client_addons TO service_role;

DROP TRIGGER IF EXISTS t_client_addons_updated_at ON public.client_addons;
CREATE TRIGGER t_client_addons_updated_at
  BEFORE UPDATE ON public.client_addons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- MRR neto de los adicionales activos del cliente.
CREATE OR REPLACE FUNCTION public.client_addons_mrr(_client_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT coalesce(sum(public.addon_monthly_net_price(a.addon_key)), 0)::integer
    FROM public.client_addons a
   WHERE a.client_id = _client_id AND a.active
$$;

-- 4) Cobros de adicionales: solo Flow los marca pagados (BEFORE) -----------------
CREATE OR REPLACE FUNCTION public.guard_addon_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.addon_key IS NULL OR NEW.status <> 'paid' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;
  IF coalesce(NEW.provider, '') <> 'flow' THEN
    RAISE EXCEPTION 'Un cobro de adicional solo se marca pagado con la confirmación de Flow'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS t_payments_addon_guard ON public.payments;
CREATE TRIGGER t_payments_addon_guard
  BEFORE INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_addon_payment();

-- 4b) Monto de cobros de plan/adicional: = suma de items y no editable por usuarios.
-- (Los editores de la agencia tienen UPDATE(amount) en payments.)
CREATE OR REPLACE FUNCTION public.guard_checkout_amount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.plan_key IS NULL AND NEW.addon_key IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND current_user IN ('anon', 'authenticated')
     AND NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION 'El monto de un cobro de plan o adicional lo fija el servidor'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.items IS NOT NULL AND NEW.amount IS DISTINCT FROM (
    SELECT coalesce(sum((i ->> 'amount')::numeric), 0) FROM jsonb_array_elements(NEW.items) i
  ) THEN
    RAISE EXCEPTION 'El monto del cobro no coincide con su desglose'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS t_payments_checkout_amount ON public.payments;
CREATE TRIGGER t_payments_checkout_amount
  BEFORE INSERT OR UPDATE OF amount, items ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_checkout_amount();

-- 5) Activa/desactiva el chatbot según su pago (AFTER) ----------------------------
CREATE OR REPLACE FUNCTION public.sync_addon_after_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  becomes_paid boolean;
  leaves_paid boolean;
BEGIN
  IF NEW.addon_key IS NULL OR public.addon_monthly_net_price(NEW.addon_key) = 0 THEN
    RETURN NULL;
  END IF;

  becomes_paid := NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status <> 'paid');
  leaves_paid := TG_OP = 'UPDATE' AND OLD.status = 'paid' AND NEW.status <> 'paid';
  IF NOT (becomes_paid OR leaves_paid) THEN
    RETURN NULL;
  END IF;
  -- Pago tardío de un cobro ya cancelado (pestaña vieja de Flow): NO activa el
  -- chatbot. El servidor registra la anomalía (payment_anomalies, 'cancelled_paid').
  IF becomes_paid AND TG_OP = 'UPDATE' AND OLD.status = 'cancelled' THEN
    RETURN NULL;
  END IF;

  -- Mismo orden de bloqueos que sync_client_membership (evita deadlocks).
  PERFORM 1 FROM public.client_billing WHERE client_id = NEW.client_id FOR UPDATE;
  PERFORM 1 FROM public.clients WHERE id = NEW.client_id FOR UPDATE;

  IF becomes_paid THEN
    INSERT INTO public.client_addons (client_id, addon_key, active, activated_at, setup_payment_id)
    VALUES (
      NEW.client_id,
      NEW.addon_key,
      true,
      coalesce(NEW.paid_at, (now() AT TIME ZONE 'America/Santiago')::date),
      NEW.id
    )
    -- Si ya estaba contratado, conserva su alta y el pago que lo activó.
    ON CONFLICT (client_id, addon_key) DO UPDATE
      SET active = true,
          activated_at = CASE
            WHEN client_addons.active THEN client_addons.activated_at
            ELSE EXCLUDED.activated_at
          END,
          deactivated_at = NULL,
          setup_payment_id = CASE
            WHEN client_addons.active THEN client_addons.setup_payment_id
            ELSE EXCLUDED.setup_payment_id
          END;
  ELSE
    -- Se revirtió el pago que lo activó: se da de baja.
    UPDATE public.client_addons
       SET active = false,
           deactivated_at = (now() AT TIME ZONE 'America/Santiago')::date
     WHERE client_id = NEW.client_id
       AND addon_key = NEW.addon_key
       AND setup_payment_id = NEW.id
       AND active;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS t_payments_addon_sync ON public.payments;
CREATE TRIGGER t_payments_addon_sync
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_addon_after_payment();

-- Cada alta o baja recalcula client_billing.mrr (también la baja desde Facturación).
CREATE OR REPLACE FUNCTION public.sync_membership_after_addon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.sync_client_membership(NEW.client_id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS t_client_addons_membership_sync ON public.client_addons;
CREATE TRIGGER t_client_addons_membership_sync
  AFTER INSERT OR UPDATE OF active ON public.client_addons
  FOR EACH ROW EXECUTE FUNCTION public.sync_membership_after_addon();

-- 6) MRR: plan mensual vigente + mantención de adicionales activos ----------------
-- Igual que en 20261012002500, salvo el cálculo de mrr.
CREATE OR REPLACE FUNCTION public.sync_client_membership(_client_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  m record;
  b public.client_billing%ROWTYPE;
  cur_status text;
  active boolean;
  monthly_active boolean;
BEGIN
  SELECT * INTO m FROM public.client_membership(_client_id);
  SELECT * INTO b FROM public.client_billing WHERE client_id = _client_id FOR UPDATE;
  SELECT c.status INTO cur_status FROM public.clients c WHERE c.id = _client_id FOR UPDATE;

  IF m.state IS NULL OR m.state = 'sin_plan' THEN
    IF b.plan_source = 'membership' THEN
      UPDATE public.client_billing
         SET plan_key = NULL, mrr = 0, billing_day = NULL,
             plan_source = NULL, status_before_membership = NULL
       WHERE client_id = _client_id;
      IF b.status_before_membership IS NOT NULL THEN
        UPDATE public.clients SET status = b.status_before_membership
         WHERE id = _client_id AND status IN ('activo', 'terminado');
      END IF;
    END IF;
    RETURN 'sin_plan';
  END IF;

  active := m.state IN ('activo', 'por_renovar', 'pago_unico');
  monthly_active := m.state IN ('activo', 'por_renovar') AND public.plan_is_monthly(m.plan_key);

  INSERT INTO public.client_billing (client_id, plan_key, mrr, billing_day, plan_source, status_before_membership)
  VALUES (
    _client_id,
    m.plan_key,
    CASE
      WHEN monthly_active
        THEN public.plan_net_price(m.plan_key) + public.client_addons_mrr(_client_id)
      ELSE 0
    END,
    CASE WHEN monthly_active THEN least(extract(day FROM m.period_start)::smallint, 28::smallint) END,
    'membership',
    cur_status
  )
  ON CONFLICT (client_id) DO UPDATE
    SET plan_key = EXCLUDED.plan_key,
        mrr = EXCLUDED.mrr,
        billing_day = EXCLUDED.billing_day,
        plan_source = 'membership',
        status_before_membership = CASE
          WHEN client_billing.plan_source = 'membership' THEN client_billing.status_before_membership
          ELSE EXCLUDED.status_before_membership
        END;

  UPDATE public.clients
     SET status = CASE WHEN active THEN 'activo' ELSE 'terminado' END,
         started_at = coalesce(started_at, m.client_since)
   WHERE id = _client_id
     AND (status, started_at) IS DISTINCT FROM
         (CASE WHEN active THEN 'activo' ELSE 'terminado' END, coalesce(started_at, m.client_since));

  RETURN m.state;
END $$;

-- Permisos ------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.guard_checkout_amount() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_addon_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_addon_after_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_membership_after_addon() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.client_addons_mrr(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_client_membership(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.addon_setup_net_price(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.addon_monthly_net_price(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.addon_setup_net_price(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.addon_monthly_net_price(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.client_addons_mrr(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_client_membership(uuid) TO service_role;

COMMIT;
