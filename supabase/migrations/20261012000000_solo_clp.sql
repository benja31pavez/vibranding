-- =====================================================================
-- VIBRANDING · CLP como única moneda de la agencia
-- =====================================================================
-- Decisión del dueño: todo el dinero de la agencia (cobros, contratos,
-- precios, órdenes de Flow) es SIEMPRE y EXCLUSIVAMENTE en CLP.
--
--   1. pricing_settings: convierte la etiqueta de moneda a 'CLP' (había
--      1 fila en EUR). Los montos NO se convierten: los precios de
--      servicios adicionales (service_pricing) se leen como CLP desde ahora.
--   2. DEFAULT 'CLP' en payments, client_contracts, pricing_settings y
--      payment_provider_orders.
--   3. CHECK (currency = 'CLP') validado en esas tablas.
--
-- Fuera de alcance (a propósito): tablas de Meta / anuncios
-- (meta_accounts, meta_ads_campaigns, ad_insights_daily): su moneda es la
-- de la cuenta publicitaria en Meta y no la decide la plataforma.
-- payment_anomalies.currency guarda lo que reportó Flow (diagnóstico) y
-- tampoco se restringe.
--
-- v3b: el navegador puede escribir payments.currency por privilegio de
-- columna (INSERT/UPDATE); con este CHECK solo puede escribir 'CLP'.
--
-- Prerrequisito verificado: los 2 cobros USD de prueba ya se borraron y no
-- hay contratos en otra moneda. Si al aplicar falla el CHECK de alguna
-- tabla, revisar antes con:
--   SELECT id, currency FROM public.payments WHERE currency <> 'CLP';
--   SELECT id, currency FROM public.client_contracts WHERE currency <> 'CLP';
--   SELECT id, currency FROM public.payment_provider_orders WHERE currency <> 'CLP';
-- y decidir caso a caso (no se borran datos en esta migración).
--
-- Idempotente: se puede ejecutar más de una vez.
-- Para revertir:
--   ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_currency_clp_chk;
--   ALTER TABLE public.client_contracts DROP CONSTRAINT IF EXISTS client_contracts_currency_clp_chk;
--   ALTER TABLE public.pricing_settings DROP CONSTRAINT IF EXISTS pricing_settings_currency_clp_chk;
--   ALTER TABLE public.payment_provider_orders DROP CONSTRAINT IF EXISTS payment_provider_orders_currency_clp_chk;
-- =====================================================================

SET LOCAL lock_timeout = '5s';

-- 1. Datos: pricing_settings pasa a CLP (solo la etiqueta de moneda).
UPDATE public.pricing_settings SET currency = 'CLP' WHERE currency IS DISTINCT FROM 'CLP';

-- 2 y 3. DEFAULT 'CLP' y CHECK (currency = 'CLP') validado (solo si no existe).
-- Una tabla que aún no exista en esta BD (p. ej. payment_provider_orders sin v3)
-- se omite con un aviso.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payments', 'client_contracts', 'pricing_settings', 'payment_provider_orders']
  LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'solo_clp: la tabla public.% no existe; se omite', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN currency SET DEFAULT %L', t, 'CLP');
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = t || '_currency_clp_chk'
        AND conrelid = format('public.%I', t)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (currency = %L)',
        t, t || '_currency_clp_chk', 'CLP'
      );
    END IF;
    EXECUTE format(
      'COMMENT ON COLUMN public.%I.currency IS %L',
      t, format('Siempre CLP (CHECK %s_currency_clp_chk).', t)
    );
  END LOOP;
END
$$;
