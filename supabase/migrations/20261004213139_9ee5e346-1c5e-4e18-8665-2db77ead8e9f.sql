-- =====================================================================
-- VIBRANDING · Plataforma v3b · cierre de columnas de payments (NO APLICAR AÚN)
-- =====================================================================
-- Aplicar SOLO después de:
--   1. 20261010000000_platform_v3.sql (crea set_payment_status), y
--   2. publicar el código del PR #17 (PaymentsPanel y /billing cambian el
--      estado vía set_payment_status y ya no escriben status/paid_at/
--      provider/flow_token/payment_url desde el navegador).
-- Con código anterior al PR #17, "Marcar pagado" y el selector de estado
-- fallarían con "permission denied".
--
-- Desde el navegador (authenticated) solo se escriben los datos del cobro:
--   INSERT: client_id, description, amount, currency, due_date,
--           document_type, kind, period
--   UPDATE: description, amount, currency, due_date, document_type, kind, period
-- status / paid_at / provider: vía set_payment_status() (owner/admin).
-- flow_token / payment_url / provider_ref / subscription_id / proposal_id:
-- solo servidor (service_role). client_id no es editable.
-- NOTA: una columna nueva en payments debe agregarse aquí si el navegador
-- necesita escribirla.
--
-- Idempotente. Para revertir (si hiciera falta):
--   GRANT INSERT, UPDATE ON public.payments TO authenticated;
-- =====================================================================

SET LOCAL lock_timeout = '5s';

REVOKE INSERT, UPDATE ON public.payments FROM anon, authenticated;
GRANT INSERT (client_id, description, amount, currency, due_date, document_type, kind, period)
  ON public.payments TO authenticated;
GRANT UPDATE (description, amount, currency, due_date, document_type, kind, period)
  ON public.payments TO authenticated;