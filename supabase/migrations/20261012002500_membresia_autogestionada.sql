-- Membresía autogestionada (decisión de Benja, 2026-10-06).
--
-- El cliente elige y paga su plan en la plataforma (Flow). Cada pago de un plan
-- mensual cubre UN mes (del día de pago al mismo día del mes siguiente, ambos
-- incluidos); no hay cobro automático ni permanencia. Marca + Web es pago único.
-- El estado comercial se DERIVA de los pagos confirmados.
--
-- APLICAR ANTES de publicar el código (el código nuevo escribe payments.plan_key).
-- Es aditiva: el código actual sigue funcionando con ella aplicada.
--
-- Clientes actuales: ninguno tiene pagos de plan, así que esta migración NO toca
-- sus filas (siguen con su clients.status y client_billing actuales). En
-- Facturación aparecen como "Sin plan vigente" hasta su primer pago.
--
-- La misma lógica vive en TypeScript (src/lib/billing/membership.ts); si cambias
-- una regla, cámbiala en ambos lados (npm run check:membership compara precios).

BEGIN;

-- 1) Período cubierto por cada pago de plan ---------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS plan_key text,
  ADD COLUMN IF NOT EXISTS period_start date,
  ADD COLUMN IF NOT EXISTS period_end date,
  ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_plan_key_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_plan_key_check CHECK (
  plan_key IS NULL OR plan_key IN ('marca-web', 'contenido', 'crecimiento', 'mantencion')
);
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_membership_period_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_membership_period_check CHECK (
  (period_start IS NULL AND period_end IS NULL)
  OR (plan_key IS NOT NULL AND period_start IS NOT NULL AND period_end > period_start)
);

COMMENT ON COLUMN public.payments.plan_key IS
  'Plan que paga este cobro (membresía). Lo escribe solo el servidor (sin GRANT al navegador).';
COMMENT ON COLUMN public.payments.period_start IS
  'Inicio del período pagado (incluido). Lo fija el trigger al confirmarse el pago.';
COMMENT ON COLUMN public.payments.period_end IS
  'Fin del período pagado (incluido): mismo día del mes siguiente.';
COMMENT ON COLUMN public.payments.followup_sent_at IS
  'Cuándo se envió el correo de seguimiento antes del fin de este período.';

CREATE INDEX IF NOT EXISTS payments_membership_idx
  ON public.payments (client_id, period_end DESC)
  WHERE plan_key IS NOT NULL AND status = 'paid';

-- Un solo cobro de plan abierto por cliente (evita duplicados por doble clic).
-- Los cobros de propuestas quedan fuera: tienen su propio índice único.
CREATE UNIQUE INDEX IF NOT EXISTS payments_open_plan_checkout_uk
  ON public.payments (client_id)
  WHERE plan_key IS NOT NULL AND proposal_id IS NULL AND status IN ('pending', 'overdue');

-- Las columnas nuevas NO se agregan a los GRANT de INSERT/UPDATE del navegador:
-- solo el servidor (service_role) y los triggers las escriben. SELECT ya es por tabla.

-- 2) Precios de lista (NETOS, CLP). Deben coincidir con src/lib/pricing/plans.ts ---
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
AS $$ SELECT _plan_key IN ('contenido', 'crecimiento', 'mantencion') $$;

-- 3) Período al confirmar el pago (BEFORE: queda en la misma fila) -----------------
CREATE OR REPLACE FUNCTION public.set_membership_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  paid date;
  prev_end date;
BEGIN
  IF NEW.plan_key IS NULL OR NEW.status <> 'paid' OR NEW.period_start IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;

  -- Dos confirmaciones simultáneas del mismo cliente no calculan el mismo período.
  PERFORM pg_advisory_xact_lock(hashtextextended('membership:' || NEW.client_id::text, 0));

  paid := coalesce(NEW.paid_at, (now() AT TIME ZONE 'America/Santiago')::date);
  SELECT max(p.period_end) INTO prev_end
    FROM public.payments p
   WHERE p.client_id = NEW.client_id
     AND p.id <> NEW.id
     AND p.status = 'paid'
     AND p.plan_key IS NOT NULL
     AND p.period_end IS NOT NULL;

  -- Renovación anticipada: encadena desde el fin del período vigente.
  NEW.period_start := CASE WHEN prev_end IS NOT NULL AND prev_end > paid THEN prev_end ELSE paid END;
  NEW.period_end := (NEW.period_start + interval '1 month')::date;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS t_payments_membership_period ON public.payments;
CREATE TRIGGER t_payments_membership_period
  BEFORE INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_membership_period();

-- 4) Estado derivado (SECURITY INVOKER: respeta la RLS de payments) ----------------
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
  cur AS (
    SELECT * FROM paid
     WHERE paid.period_start <= _today AND paid.period_end >= _today
     ORDER BY paid.period_end DESC
     LIMIT 1
  ),
  last_paid AS (SELECT * FROM paid ORDER BY paid.period_end DESC LIMIT 1),
  agg AS (
    SELECT min(paid.paid_on) AS since,
           max(paid.period_end) FILTER (WHERE paid.period_end >= _today) AS covered
      FROM paid
  )
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM cur) THEN
        CASE WHEN (SELECT covered FROM agg) - _today <= 5 THEN 'por_renovar' ELSE 'activo' END
      WHEN EXISTS (SELECT 1 FROM paid) THEN 'finalizado'
      ELSE 'sin_plan'
    END,
    EXISTS (SELECT 1 FROM cur) AND _today - (SELECT since FROM agg) < 7,
    coalesce((SELECT cur.plan_key FROM cur), (SELECT last_paid.plan_key FROM last_paid)),
    (SELECT cur.period_start FROM cur),
    (SELECT cur.period_end FROM cur),
    CASE WHEN EXISTS (SELECT 1 FROM cur) THEN (SELECT covered FROM agg) END,
    (SELECT since FROM agg)
$$;

COMMENT ON FUNCTION public.client_membership(uuid, date) IS
  'Estado comercial derivado de los pagos de plan: sin_plan | activo | por_renovar | finalizado. Espejo de src/lib/billing/membership.ts.';

-- 5) Sincroniza client_billing y clients.status desde los pagos --------------------
-- Solo toca clientes con al menos un pago de plan confirmado.
CREATE OR REPLACE FUNCTION public.sync_client_membership(_client_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  m record;
  active boolean;
BEGIN
  SELECT * INTO m FROM public.client_membership(_client_id);
  IF m.state IS NULL OR m.state = 'sin_plan' THEN
    RETURN 'sin_plan';
  END IF;
  active := m.state IN ('activo', 'por_renovar');

  INSERT INTO public.client_billing (client_id, plan_key, mrr, billing_day)
  VALUES (
    _client_id,
    m.plan_key,
    CASE WHEN active AND public.plan_is_monthly(m.plan_key) THEN public.plan_net_price(m.plan_key) ELSE 0 END,
    CASE WHEN active THEN least(extract(day FROM m.period_start)::smallint, 28::smallint) END
  )
  ON CONFLICT (client_id) DO UPDATE
    SET plan_key = EXCLUDED.plan_key,
        mrr = EXCLUDED.mrr,
        billing_day = EXCLUDED.billing_day
  WHERE (client_billing.plan_key, client_billing.mrr, client_billing.billing_day)
        IS DISTINCT FROM (EXCLUDED.plan_key, EXCLUDED.mrr, EXCLUDED.billing_day);

  -- Nunca "prospecto" ni "pausado" para un cliente con pagos: activo o terminado.
  UPDATE public.clients
     SET status = CASE WHEN active THEN 'activo' ELSE 'terminado' END,
         started_at = m.client_since
   WHERE id = _client_id
     AND (status, started_at) IS DISTINCT FROM
         (CASE WHEN active THEN 'activo' ELSE 'terminado' END, m.client_since);

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
    SELECT DISTINCT p.client_id FROM public.payments p
     WHERE p.plan_key IS NOT NULL AND p.status = 'paid'
  LOOP
    PERFORM public.sync_client_membership(cid);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Funciones internas: nadie las llama desde el navegador.
REVOKE ALL ON FUNCTION public.set_membership_period() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_membership_after_payment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_client_membership(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_client_memberships() FROM PUBLIC, anon, authenticated;
-- client_membership es SECURITY INVOKER (la RLS de payments decide qué ve cada uno).
REVOKE ALL ON FUNCTION public.client_membership(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_membership(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_net_price(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_is_monthly(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_client_membership(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_client_memberships() TO service_role;

COMMIT;
