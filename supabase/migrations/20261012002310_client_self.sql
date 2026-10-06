-- =====================================================================
-- Fase 0 · 2/5 — El usuario cliente ya no lee la fila completa de clients
-- =====================================================================
-- Problema (H5): la policy "clients select" incluía `id = user_client_id()`,
-- así que el usuario invitado de un cliente leía su fila COMPLETA: notes
-- (notas internas de la agencia), org_id y user_id (los grants de columna de
-- authenticated cubren todas las columnas).
--
-- Cambio:
--   1. Vista public.client_self con columnas seguras, filtrada por
--      user_client_id(). Es "definer" (security_invoker = false) como
--      portal_payments: lee clients con los permisos del dueño de la vista,
--      pero el WHERE fija la fila al cliente del usuario que consulta y
--      security_barrier impide que filtros del usuario se evalúen antes.
--      Para un miembro de la agencia devuelve 0 filas (user_client_id() es
--      NULL). anon no tiene acceso.
--   2. "clients select" queda solo para miembros de la org.
--
-- Código que dependía de esto: src/lib/portal/portal.server.ts (nombre del
-- cliente en el portal) y el logo de la cabecera del portal; ambos pasan a
-- client_self en el mismo PR. Hoy hay 0 filas en client_users, así que
-- nadie pierde acceso al aplicar.
--
-- Orden: aplicar ANTES (o junto) de desplegar el código del PR; si el código
-- llega primero, el portal de un usuario cliente fallaría al leer
-- client_self (hoy no hay usuarios cliente).
-- Re-ejecutable.
-- =====================================================================

CREATE OR REPLACE VIEW public.client_self
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  c.id,
  c.name,
  c.instagram_handle,
  c.logo_url,
  c.business_description,
  c.status,
  c.started_at
FROM public.clients c
WHERE c.id = public.user_client_id();

COMMENT ON VIEW public.client_self IS
  'Fila segura del cliente para su usuario invitado (sin notes, org_id ni user_id).';

REVOKE ALL ON public.client_self FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.client_self TO authenticated, service_role;

DROP POLICY IF EXISTS "clients select" ON public.clients;
CREATE POLICY "clients select" ON public.clients
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

NOTIFY pgrst, 'reload schema';
