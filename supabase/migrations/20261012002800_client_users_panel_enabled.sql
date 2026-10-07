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
--     manages_client, y además el trigger guard_client_users_update).
--     Lo cambia el owner/admin de la agencia.
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

-- ---------------------------------------------------------------------
-- Defensa en profundidad: aunque una policy futura abriera UPDATE de
-- client_users al propio usuario, solo el owner/admin de la agencia del
-- cliente (manages_client) puede cambiar panel_enabled, client_id o user_id.
-- service_role / postgres (server functions con supabaseAdmin, migraciones)
-- no pasan por esta regla: current_user no es anon ni authenticated.
-- SECURITY INVOKER a propósito: current_user debe ser el rol que llama.
-- Hoy el código de la agencia no hace UPDATE de client_users (invitar =
-- INSERT con service_role; revocar = DELETE), así que no rompe nada.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_client_users_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF NEW.panel_enabled IS DISTINCT FROM OLD.panel_enabled
     OR NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    IF NOT public.manages_client(OLD.client_id)
       OR NOT public.manages_client(NEW.client_id) THEN
      RAISE EXCEPTION 'solo la agencia del cliente puede cambiar este acceso'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_client_users_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_client_users_guard_update ON public.client_users;
CREATE TRIGGER t_client_users_guard_update
  BEFORE UPDATE ON public.client_users
  FOR EACH ROW EXECUTE FUNCTION public.guard_client_users_update();

NOTIFY pgrst, 'reload schema';
