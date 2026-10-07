-- =====================================================================
-- Acceso de clientes · Fase 1 — Interruptor del panel del cliente (/mi)
-- =====================================================================
-- El portal (/portal) sigue siendo el destino por defecto del usuario
-- cliente. Con panel_enabled = true, ese usuario entra al panel nuevo
-- (/mi: el panel izquierdo del cliente, sin header de agencia). Sirve para
-- probar con un cliente de prueba sin afectar a nadie.
--
-- Seguridad:
--   * Solo es una preferencia de navegación: los datos siguen protegidos por
--     RLS, client_self y las server functions del portal.
--   * El propio cliente lo puede LEER (policy "client_users select":
--     user_id = auth.uid()) pero NO cambiarlo ("client_users update" exige
--     manages_client). Lo cambia el owner/admin de la agencia.
--
-- Activar para un usuario cliente (SQL Editor de Supabase):
--   UPDATE public.client_users SET panel_enabled = true
--   WHERE lower(email) = lower('cliente-de-prueba@ejemplo.cl');
-- Desactivar: el mismo UPDATE con false.
--
-- Sin esta columna el front asume false (todo sigue en /portal).
-- Re-ejecutable.
-- =====================================================================

ALTER TABLE public.client_users
  ADD COLUMN IF NOT EXISTS panel_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.client_users.panel_enabled IS
  'true = el usuario cliente entra al panel del cliente (/mi) en vez del portal (/portal).';

NOTIFY pgrst, 'reload schema';
