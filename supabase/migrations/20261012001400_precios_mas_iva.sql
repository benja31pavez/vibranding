-- =====================================================================
-- Precios netos + IVA y Plan Mantención (decisión 2026-10-05)
-- =====================================================================
-- NO SE APLICA SOLA: revisar y aplicar a mano. El código ya es tolerante si
-- aún no se aplicó (src/lib/pricing/planKeyDb.ts): guarda plan_key = NULL
-- cuando la BD rechaza 'mantencion' y avisa en pantalla.
--
-- Qué hace:
--   1. Los CHECK de plan_key (client_billing, subscriptions, proposals)
--      aceptan además 'mantencion'.
--   2. convert_prospect_to_client() acepta 'mantencion' (mismo cuerpo que la
--      v3; solo cambia la lista de planes válidos).
--   3. COMMENT ON COLUMN documenta la semántica de los montos.
--
-- Qué NO hace (a propósito):
--   - No cambia ningún monto guardado. payments.amount,
--     subscriptions.amount_clp, proposals.amount_clp / items[].amount y los
--     totales de client_contracts siguen siendo el TOTAL a pagar con IVA, igual
--     que antes (los precios de antes eran "IVA incluido"). Desde 2026-10 los
--     precios de lista son netos y el código guarda withIva(neto).
--   - No toca service_pricing ni pricing_settings: sus precios se leen como
--     NETOS desde 2026-10 (pantalla Precios). Revisar a mano los adicionales
--     cargados antes con IVA incluido.
--   - client_billing.mrr se interpreta como NETO desde 2026-10; los valores
--     cargados antes pueden tener IVA. Para revisarlos:
--       SELECT client_id, plan_key, mrr FROM public.client_billing
--       WHERE mrr IN (129990, 249990) ORDER BY plan_key;

-- 1. CHECK de plan_key --------------------------------------------------

ALTER TABLE public.client_billing DROP CONSTRAINT IF EXISTS client_billing_plan_key_chk;
ALTER TABLE public.client_billing ADD CONSTRAINT client_billing_plan_key_chk
  CHECK (plan_key IS NULL OR plan_key IN ('marca-web', 'contenido', 'crecimiento', 'mantencion'))
  NOT VALID;
ALTER TABLE public.client_billing VALIDATE CONSTRAINT client_billing_plan_key_chk;

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_key_chk;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_key_chk
  CHECK (plan_key IN ('marca-web', 'contenido', 'crecimiento', 'mantencion'))
  NOT VALID;
ALTER TABLE public.subscriptions VALIDATE CONSTRAINT subscriptions_plan_key_chk;

ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_plan_key_chk;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_plan_key_chk
  CHECK (plan_key IS NULL OR plan_key IN ('marca-web', 'contenido', 'crecimiento', 'mantencion'))
  NOT VALID;
ALTER TABLE public.proposals VALIDATE CONSTRAINT proposals_plan_key_chk;

-- 2. convert_prospect_to_client acepta 'mantencion' ---------------------
-- Copia de la v3 (20261010000000_platform_v3.sql, C10); solo cambia la lista
-- de plan_key válidos. _mrr_clp es el MRR NETO del plan.
CREATE OR REPLACE FUNCTION public.convert_prospect_to_client(
  _prospect_id uuid,
  _plan_key text,
  _mrr_clp integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  pr public.prospects%ROWTYPE;
  oid_ uuid;
  new_client uuid;
  creator uuid;
BEGIN
  IF _prospect_id IS NULL THEN
    RAISE EXCEPTION 'prospect_id es obligatorio' USING ERRCODE = '22023';
  END IF;

  SELECT org_id INTO oid_ FROM public.prospects WHERE id = _prospect_id;
  IF oid_ IS NULL OR NOT public.can_edit_org(oid_) THEN
    RAISE EXCEPTION 'No tienes permisos para esta acción' USING ERRCODE = '42501';
  END IF;

  -- FOR UPDATE: dos clics simultáneos se serializan; el segundo ve client_id.
  SELECT * INTO pr FROM public.prospects WHERE id = _prospect_id FOR UPDATE;

  IF pr.client_id IS NOT NULL THEN
    RETURN jsonb_build_object('client_id', pr.client_id, 'created', false);
  END IF;
  IF pr.estado = 'baja' THEN
    RAISE EXCEPTION 'El prospecto pidió la baja: no se puede convertir en cliente' USING ERRCODE = '22023';
  END IF;
  IF _plan_key IS NOT NULL AND _plan_key NOT IN ('marca-web', 'contenido', 'crecimiento', 'mantencion') THEN
    RAISE EXCEPTION 'plan_key inválido' USING ERRCODE = '22023';
  END IF;
  IF _mrr_clp IS NULL OR _mrr_clp < 0 OR _mrr_clp > 100000000 THEN
    RAISE EXCEPTION 'mrr_clp debe estar entre 0 y 100.000.000' USING ERRCODE = '22023';
  END IF;

  -- clients.user_id (legado) es NOT NULL: el usuario que convierte.
  creator := auth.uid();

  INSERT INTO public.clients (user_id, org_id, name, instagram_handle, status, started_at)
  VALUES (creator, pr.org_id, pr.nombre, nullif(btrim(coalesce(pr.instagram, '')), ''), 'onboarding',
          (now() AT TIME ZONE 'America/Santiago')::date)
  RETURNING id INTO new_client;

  -- La fila de client_billing la crea t_client_billing_create; upsert por si acaso.
  INSERT INTO public.client_billing (client_id, plan_key, mrr)
  VALUES (new_client, _plan_key, _mrr_clp)
  ON CONFLICT (client_id) DO UPDATE SET plan_key = EXCLUDED.plan_key, mrr = EXCLUDED.mrr;

  UPDATE public.prospects
     SET estado = 'ganado', client_id = new_client
   WHERE id = pr.id;

  RETURN jsonb_build_object('client_id', new_client, 'created', true);
END $$;

REVOKE ALL ON FUNCTION public.convert_prospect_to_client(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_prospect_to_client(uuid, text, integer) TO authenticated, service_role;

-- 3. Semántica de los montos --------------------------------------------

COMMENT ON COLUMN public.client_billing.mrr IS
  'MRR NETO (sin IVA) en CLP, entero. Desde 2026-10; valores anteriores pueden traer IVA incluido.';
COMMENT ON COLUMN public.subscriptions.amount_clp IS
  'Cobro mensual en CLP = total a pagar CON IVA (neto × 1,19 redondeado). El MRR usa el neto.';
COMMENT ON COLUMN public.payments.amount IS
  'Total a pagar en CLP CON IVA (lo que cobra Flow). Cobros nuevos: neto × 1,19 redondeado.';
COMMENT ON COLUMN public.proposals.amount_clp IS
  'Primer pago en CLP CON IVA = Σ items[].amount (cada ítem guarda su total con IVA).';
