-- Membresía autogestionada (decisión de Benja, 2026-10-06).
--
-- El cliente elige y paga su plan en la plataforma (Flow). Cada pago de un plan
-- MENSUAL cubre un mes: [inicio, inicio + 1 mes - 1 día], ambos incluidos,
-- anclado al día del primer período de la cadena (31-ene → 27-feb, 28-feb →
-- 30-mar…): sin solape ni deriva. Renovar antes de vencer (o el mismo día del
-- fin) encadena desde el día siguiente al fin; renovar después parte el día del
-- pago con ancla nueva. Marca + Web es pago único: sin período ni vencimiento.
-- El estado comercial se DERIVA de los pagos confirmados por Flow.
--
-- APLICAR ANTES de publicar el código (el código nuevo lee/escribe estas columnas).
-- Es aditiva: el código actual sigue funcionando con ella aplicada.
--
-- Clientes actuales: ninguno tiene pagos de plan, así que esta migración NO toca
-- sus filas. En Facturación aparecen como "Sin plan vigente" hasta su primer pago.
--
-- Espejo en TypeScript: src/lib/billing/membership.ts (npm run check:membership
-- compara precios, ventana de renovación y onboarding).

BEGIN;

SET LOCAL lock_timeout = '5s';

-- 1) Columnas ---------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS plan_key text,
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS period_anchor_day smallint,
  ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_plan_key_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_plan_key_check CHECK (
  plan_key IS NULL OR plan_key IN ('marca-web', 'contenido', 'crecimiento', 'mantencion')
);
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_membership_period_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_membership_period_check CHECK (
  (period_start IS NULL AND period_end IS NULL AND period_anchor_day IS NULL)
  OR (
    plan_key IS NOT NULL AND status = 'paid'
    AND period_start IS NOT NULL AND period_end > period_start
    AND period_anchor_day BETWEEN 1 AND 31
  )
);

COMMENT ON COLUMN public.payments.plan_key IS
  'Plan que paga este cobro (membresía). Solo lo escribe el servidor.';
COMMENT ON COLUMN public.payments.period_start IS
  'Inicio del período pagado (incluido). Lo fija el trigger al confirmarse el pago por Flow.';
COMMENT ON COLUMN public.payments.period_end IS
  'Fin del período pagado (incluido): inicio + 1 mes (anclado) - 1 día.';
COMMENT ON COLUMN public.payments.period_anchor_day IS
  'Día del mes al que se anclan los períodos de la cadena (día del primer período).';
COMMENT ON COLUMN public.payments.followup_sent_at IS
  'Cuándo se envió el correo de seguimiento antes del fin de este período.';

-- Origen de client_billing: 'membership' = lo fijaron los pagos (se puede revertir).
ALTER TABLE public.client_billing
  ADD COLUMN IF NOT EXISTS plan_source text,
  ADD COLUMN IF NOT EXISTS status_before_membership text;
ALTER TABLE public.client_billing DROP CONSTRAINT IF EXISTS client_billing_plan_source_check;
ALTER TABLE public.client_billing ADD CONSTRAINT client_billing_plan_source_check CHECK (
  plan_source IS NULL OR plan_source = 'membership'
);

-- Solo el servidor y los triggers escriben estas columnas.
REVOKE INSERT (plan_key, period_start, period_end, period_anchor_day, followup_sent_at),
       UPDATE (plan_key, period_start, period_end, period_anchor_day, followup_sent_at)
  ON public.payments FROM anon, authenticated;
REVOKE INSERT (plan_source, status_before_membership),
       UPDATE (plan_source, status_before_membership)
  ON public.client_billing FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS payments_membership_idx
  ON public.payments (client_id, period_end DESC)
  WHERE plan_key IS NOT NULL AND status = 'paid';

-- Un solo cobro de plan abierto por cliente (evita duplicados por doble clic).
-- Los cobros de propuestas quedan fuera: tienen su propio índice único.
CREATE UNIQUE INDEX IF NOT EXISTS payments_open_plan_checkout_uk
  ON public.payments (client_id)
  WHERE plan_key IS NOT NULL AND proposal_id IS NULL AND status IN ('pending', 'overdue');

-- 2) Planes (NETOS, CLP). Deben coincidir con src/lib/pricing/plans.ts --------------
CREATE OR REPLACE FUNCTION public.plan_net_price(_plan_key text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT CASE _plan_key
    WHEN 'marca-web' THEN 149990
    WHEN 'contenido' THEN 129990
    WHEN 'crecimiento' THEN 249990
    WHEN 'mantencion' THEN 69990
  END
$$;

CREATE OR REPLACE FUNCTION public.plan_is_monthly(_plan_key text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$ SELECT coalesce(_plan_key IN ('contenido', 'crecimiento', 'mantencion'), false) $$;

-- Fin inclusivo: siguiente fecha anclada (día ancla o último día del mes) - 1 día.
CREATE OR REPLACE FUNCTION public.membership_period_end(_start date, _anchor integer)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $$
  SELECT make_date(
           extract(year FROM n)::int,
           extract(month FROM n)::int,
           least(_anchor, extract(day FROM (n + interval '1 month' - interval '1 day'))::int)
         ) - 1
    FROM (SELECT (date_trunc('month', _start) + interval '1 month')::date AS n) x
$$;

-- 3) Período al confirmarse el pago (BEFORE: queda en la misma fila) ---------------
CREATE OR REPLACE FUNCTION public.set_membership_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  paid date;
  prev_end date;
  prev_anchor smallint;
BEGIN
  IF NEW.plan_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- Sale de 'paid' (cancelación/reversión): pierde su período.
  IF NEW.status <> 'paid' THEN
    IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN
      NEW.period_start := NULL;
      NEW.period_end := NULL;
      NEW.period_anchor_day := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Sigue pagado: nada que recalcular.
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;

  -- Transición → 'paid': un plan solo se activa con un pago confirmado por Flow
  -- (set_payment_status deja provider = 'manual' y queda rechazado aquí).
  IF coalesce(NEW.provider, '') <> 'flow' THEN
    RAISE EXCEPTION 'Un cobro de plan solo se marca pagado con la confirmación de Flow'
      USING ERRCODE = '42501';
  END IF;

  NEW.period_start := NULL;
  NEW.period_end := NULL;
  NEW.period_anchor_day := NULL;
  IF NOT public.plan_is_monthly(NEW.plan_key) THEN
    RETURN NEW; -- Marca + Web: pago único, sin período.
  END IF;

  -- Dos confirmaciones simultáneas del mismo cliente no calculan el mismo período.
  PERFORM pg_advisory_xact_lock(hashtextextended('membership:' || NEW.client_id::text, 0));
  paid := coalesce(NEW.paid_at, (now() AT TIME ZONE 'America/Santiago')::date);

  -- Pago tardío de un cobro ya cancelado (pestaña vieja de Flow): queda pagado,
  -- pero sin período si ya hay uno vigente o un pago de plan posterior. El
  -- servidor registra la anomalía (payment_anomalies, kind 'cancelled_paid').
  IF TG_OP = 'UPDATE' AND OLD.status = 'cancelled' AND EXISTS (
    SELECT 1 FROM public.payments p
     WHERE p.client_id = NEW.client_id
       AND p.id <> NEW.id
       AND p.status = 'paid'
       AND p.plan_key IS NOT NULL
       AND (p.period_end >= paid OR p.created_at > NEW.created_at)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT p.period_end, p.period_anchor_day INTO prev_end, prev_anchor
    FROM public.payments p
   WHERE p.client_id = NEW.client_id
     AND p.id <> NEW.id
     AND p.status = 'paid'
     AND p.period_end IS NOT NULL
   ORDER BY p.period_end DESC
   LIMIT 1;

  IF prev_end IS NOT NULL AND paid <= prev_end THEN
    -- Renovación antes de vencer: encadena sin solape y conserva el ancla.
    NEW.period_start := prev_end + 1;
    NEW.period_anchor_day := prev_anchor;
  ELSE
    NEW.period_start := paid;
    NEW.period_anchor_day := extract(day FROM paid)::smallint;
  END IF;
  NEW.period_end := public.membership_period_end(NEW.period_start, NEW.period_anchor_day);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS t_payments_membership_period ON public.payments;
CREATE TRIGGER t_payments_membership_period
  BEFORE INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_membership_period();

-- 4) Estado derivado (SECURITY INVOKER: respeta la RLS de payments) ----------------
-- state: sin_plan | pago_unico | activo | por_renovar | finalizado
CREATE OR REPLACE FUNCTION public.client_membership(
  _client_id uuid,
  _today date DEFAULT ((now() AT TIME ZONE 'America/Santiago')::date)
)
RETURNS TABLE (
  state text,
  onboarding boolean,
  plan_key text,
  period_start date,
  period_end date,
  covered_until date,
  client_since date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  WITH paid AS (
    SELECT p.plan_key, p.period_start, p.period_end, coalesce(p.paid_at, p.period_start) AS paid_on
      FROM public.payments p
     WHERE p.client_id = _client_id
       AND p.status = 'paid'
       AND p.plan_key IS NOT NULL
       AND p.period_start IS NOT NULL
  ),
  onetime_all AS (
    SELECT p.plan_key, p.paid_at AS paid_on
      FROM public.payments p
     WHERE p.client_id = _client_id
       AND p.status = 'paid'
       AND p.paid_at IS NOT NULL
       AND p.plan_key IS NOT NULL
       AND NOT public.plan_is_monthly(p.plan_key)
  ),
  onetime AS (SELECT * FROM onetime_all ORDER BY onetime_all.paid_on DESC LIMIT 1),
  cur AS (
    SELECT * FROM paid
     WHERE paid.period_start <= _today AND paid.period_end >= _today
     ORDER BY paid.period_end DESC
     LIMIT 1
  ),
  last_paid AS (SELECT * FROM paid ORDER BY paid.period_end DESC LIMIT 1),
  agg AS (
    SELECT least(
             (SELECT min(paid.paid_on) FROM paid),
             (SELECT min(onetime_all.paid_on) FROM onetime_all)
           ) AS since,
           (SELECT max(paid.period_end) FROM paid WHERE paid.period_end >= _today) AS covered
  )
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM cur) THEN
        CASE WHEN (SELECT covered FROM agg) - _today <= 5 THEN 'por_renovar' ELSE 'activo' END
      WHEN EXISTS (SELECT 1 FROM paid) THEN 'finalizado'
      WHEN EXISTS (SELECT 1 FROM onetime) THEN 'pago_unico'
      ELSE 'sin_plan'
    END,
    (EXISTS (SELECT 1 FROM cur) OR (NOT EXISTS (SELECT 1 FROM paid) AND EXISTS (SELECT 1 FROM onetime)))
      AND _today - (SELECT since FROM agg) < 7,
    coalesce(
      (SELECT cur.plan_key FROM cur),
      (SELECT last_paid.plan_key FROM last_paid),
      (SELECT onetime.plan_key FROM onetime)
    ),
    (SELECT cur.period_start FROM cur),
    (SELECT cur.period_end FROM cur),
    CASE WHEN EXISTS (SELECT 1 FROM cur) THEN (SELECT covered FROM agg) END,
    (SELECT since FROM agg)
$$;

COMMENT ON FUNCTION public.client_membership(uuid, date) IS
  'Estado comercial derivado de los pagos de plan. Espejo de src/lib/billing/membership.ts.';

-- 5) Sincroniza client_billing y clients desde los pagos ---------------------------
-- Solo toca clientes con pagos de plan o cuyo client_billing fijó la membresía.
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

  -- Sin pagos de plan válidos (p. ej. se revirtió el único): se deshace solo lo
  -- que fijó la membresía.
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

  -- Pago único (Marca + Web) cuenta como activo y nunca pasa a "terminado".
  active := m.state IN ('activo', 'por_renovar', 'pago_unico');
  monthly_active := m.state IN ('activo', 'por_renovar') AND public.plan_is_monthly(m.plan_key);

  INSERT INTO public.client_billing (client_id, plan_key, mrr, billing_day, plan_source, status_before_membership)
  VALUES (
    _client_id,
    m.plan_key,
    CASE WHEN monthly_active THEN public.plan_net_price(m.plan_key) ELSE 0 END,
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

  -- Nunca "prospecto" ni "pausado" para un cliente con pagos: activo o terminado.
  -- started_at ("cliente desde") solo se completa si estaba vacío.
  UPDATE public.clients
     SET status = CASE WHEN active THEN 'activo' ELSE 'terminado' END,
         started_at = coalesce(started_at, m.client_since)
   WHERE id = _client_id
     AND (status, started_at) IS DISTINCT FROM
         (CASE WHEN active THEN 'activo' ELSE 'terminado' END, coalesce(started_at, m.client_since));

  RETURN m.state;
END $$;

CREATE OR REPLACE FUNCTION public.sync_membership_after_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF NEW.plan_key IS NOT NULL AND (
       NEW.status = 'paid' OR (TG_OP = 'UPDATE' AND OLD.status = 'paid')
     ) THEN
    PERFORM public.sync_client_membership(NEW.client_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS t_payments_membership_sync ON public.payments;
CREATE TRIGGER t_payments_membership_sync
  AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_membership_after_payment();

-- 6) Recalcula todos (fin de período sin renovación → terminado). Lo llama el cron.
CREATE OR REPLACE FUNCTION public.refresh_client_memberships()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  cid uuid;
  n integer := 0;
BEGIN
  FOR cid IN
    SELECT p.client_id FROM public.payments p
     WHERE p.plan_key IS NOT NULL AND p.status = 'paid'
    UNION
    SELECT b.client_id FROM public.client_billing b WHERE b.plan_source = 'membership'
  LOOP
    PERFORM public.sync_client_membership(cid);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Permisos: funciones internas solo para triggers, cron y service_role.
REVOKE ALL ON FUNCTION public.set_membership_period() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_membership_after_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_client_membership(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_client_memberships() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.plan_net_price(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.plan_is_monthly(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.membership_period_end(date, integer) FROM PUBLIC, anon;
-- client_membership es SECURITY INVOKER (la RLS de payments decide qué ve cada uno).
REVOKE ALL ON FUNCTION public.client_membership(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_membership(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_net_price(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_is_monthly(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.membership_period_end(date, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_client_membership(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_client_memberships() TO service_role;

COMMIT;
