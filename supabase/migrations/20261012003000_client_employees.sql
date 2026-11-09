-- =====================================================================
-- Personal del cliente · tabla client_employees (CRUD de empleados)
-- =====================================================================
-- APLICAR ANTES de publicar el código del PR "Personal: CRUD de empleados".
-- La página /clients/<id>/personal lee de public.client_employees y hace
-- insert/update/delete directo (RLS decide quién puede). Sin esta migración
-- la página sigue funcionando: muestra el error de carga igual que las otras
-- secciones y nada rompe el resto de la plataforma.
--
-- Qué hace:
--   1. public.client_employees: una fila por persona del equipo del cliente
--      (nombre, RUT opcional, contacto, cargo, rango, departamento, estado,
--      fechas de ingreso/salida y notas). El estado viene limitado por un
--      CHECK; el RUT va como text (la UI lo valida con módulo 11 antes de
--      guardar).
--   2. RLS: SELECT para cualquier miembro del org del cliente (owns_client);
--      INSERT/UPDATE/DELETE solo para owner/admin/agent (can_edit_client).
--      El usuario del portal del cliente (user_client_id) NO puede leer su
--      lista de empleados: es información interna de la agencia.
--   3. Índice por client_id y por (client_id, created_at desc) para la lista.
--   4. Trigger set_updated_at usando public.touch_updated_at() (ya existe en
--      la BD; se definió en 20260512184547).
--
-- Idempotente: se puede volver a correr sin romper nada.
-- =====================================================================

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------- tabla

CREATE TABLE IF NOT EXISTS public.client_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  rut text,
  email text,
  phone text,
  role text,
  rank text,
  department text,
  status text NOT NULL DEFAULT 'activo',
  started_at date,
  ended_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_employees_status_chk
    CHECK (status IN ('activo', 'licencia', 'vacaciones', 'permiso', 'terminado')),
  CONSTRAINT client_employees_full_name_chk
    CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 160),
  CONSTRAINT client_employees_rut_len_chk
    CHECK (rut IS NULL OR char_length(rut) BETWEEN 3 AND 20),
  CONSTRAINT client_employees_email_len_chk
    CHECK (email IS NULL OR char_length(email) <= 254),
  CONSTRAINT client_employees_phone_len_chk
    CHECK (phone IS NULL OR char_length(phone) <= 40),
  CONSTRAINT client_employees_role_len_chk
    CHECK (role IS NULL OR char_length(role) <= 80),
  CONSTRAINT client_employees_rank_len_chk
    CHECK (rank IS NULL OR char_length(rank) <= 40),
  CONSTRAINT client_employees_department_len_chk
    CHECK (department IS NULL OR char_length(department) <= 80),
  CONSTRAINT client_employees_notes_len_chk
    CHECK (notes IS NULL OR char_length(notes) <= 4000),
  CONSTRAINT client_employees_dates_chk
    CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

COMMENT ON TABLE public.client_employees IS
  'Equipo del cliente pyme (CRUD interno de la agencia). Un registro por persona.';
COMMENT ON COLUMN public.client_employees.status IS
  'activo | licencia | vacaciones | permiso | terminado. El UI muestra la etiqueta en español.';

CREATE INDEX IF NOT EXISTS idx_client_employees_client_id
  ON public.client_employees (client_id);
CREATE INDEX IF NOT EXISTS idx_client_employees_client_created_at
  ON public.client_employees (client_id, created_at DESC);

ALTER TABLE public.client_employees ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------- RLS

DROP POLICY IF EXISTS "client_employees select" ON public.client_employees;
DROP POLICY IF EXISTS "client_employees insert" ON public.client_employees;
DROP POLICY IF EXISTS "client_employees update" ON public.client_employees;
DROP POLICY IF EXISTS "client_employees delete" ON public.client_employees;

-- Lectura: cualquier miembro del org del cliente (owner/admin/agent/viewer).
CREATE POLICY "client_employees select" ON public.client_employees
  FOR SELECT TO authenticated
  USING (public.owns_client(client_id));

-- Escritura: solo editores (owner/admin/agent). can_edit_client ya niega al
-- usuario del portal cliente (nunca es miembro del org).
CREATE POLICY "client_employees insert" ON public.client_employees
  FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_client(client_id));
CREATE POLICY "client_employees update" ON public.client_employees
  FOR UPDATE TO authenticated
  USING (public.can_edit_client(client_id))
  WITH CHECK (public.can_edit_client(client_id));
CREATE POLICY "client_employees delete" ON public.client_employees
  FOR DELETE TO authenticated
  USING (public.can_edit_client(client_id));

REVOKE ALL ON public.client_employees FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_employees TO authenticated;
GRANT ALL ON public.client_employees TO service_role;

-- ---------------------------------------------------------------- trigger

DROP TRIGGER IF EXISTS t_client_employees_u ON public.client_employees;
CREATE TRIGGER t_client_employees_u
  BEFORE UPDATE ON public.client_employees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
