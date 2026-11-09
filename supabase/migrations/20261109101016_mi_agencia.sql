-- =====================================================================
-- Mi agencia · tablas propias de la agencia (gastos, RRHH, empresa, bancos)
-- =====================================================================
-- Aplicar antes del PR "Mi agencia": sus pantallas leen y escriben en
-- public.agency_expenses, public.agency_employees, public.agency_profile y
-- public.agency_bank_accounts. Sin esta migración las listas quedan vacías
-- y los botones "Agregar" muestran el error de RLS.
--
-- Diseño:
--   1. Todo vive bajo la org del usuario (public.orgs), no bajo un cliente:
--      son datos de la propia agencia (Vibranding SpA), no de sus clientes.
--   2. RLS:
--        SELECT → cualquier miembro de la org (is_org_member).
--        INSERT/UPDATE/DELETE → solo owner/admin (is_org_manager); el resto
--        ve los datos pero no los puede tocar.
--   3. En la plataforma hoy una cuenta queda dueña de "su" org vía
--      ensure_org(), así que cada agencia tiene su propio registro y nadie
--      ve los datos de otra.
--   4. agency_profile es única por org (UNIQUE org_id): guarda razón social,
--      RUT, giro, domicilio y representante legal.
--   5. agency_bank_accounts: varias cuentas por org, con banco (código del
--      listado chileno en src/lib/finance/banks.ts) y tipo de cuenta.
--   6. agency_employees: datos de RRHH (cargo, teléfono, antigüedad) opcionales
--      enlazados por org + user_id a la fila de org_members. No hereda datos
--      de org_members: la lista de miembros sigue siendo esa tabla.
--   7. agency_expenses: gastos de la agencia (suscripciones, servicios).
--      Guarda proveedor, fecha, concepto, neto, IVA, total y categoría.
--
-- Idempotente. No se crean grants nuevos a anon; solo a authenticated y a
-- service_role para que las server functions con admin puedan operar.
-- =====================================================================

SET LOCAL lock_timeout = '5s';

-- ---------------------------------------------------------------- perfil

CREATE TABLE IF NOT EXISTS public.agency_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.orgs(id) ON DELETE CASCADE,
  legal_name text NOT NULL DEFAULT '',
  rut text NOT NULL DEFAULT '',
  giro text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  commune text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  legal_representative text NOT NULL DEFAULT '',
  legal_representative_rut text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  billing_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_profile_legal_name_chk CHECK (char_length(legal_name) <= 160),
  CONSTRAINT agency_profile_rut_chk CHECK (char_length(rut) <= 20),
  CONSTRAINT agency_profile_giro_chk CHECK (char_length(giro) <= 160),
  CONSTRAINT agency_profile_address_chk CHECK (char_length(address) <= 200),
  CONSTRAINT agency_profile_commune_chk CHECK (char_length(commune) <= 80),
  CONSTRAINT agency_profile_city_chk CHECK (char_length(city) <= 80),
  CONSTRAINT agency_profile_rep_chk CHECK (char_length(legal_representative) <= 160),
  CONSTRAINT agency_profile_rep_rut_chk CHECK (char_length(legal_representative_rut) <= 20),
  CONSTRAINT agency_profile_contact_email_chk CHECK (char_length(contact_email) <= 200),
  CONSTRAINT agency_profile_contact_phone_chk CHECK (char_length(contact_phone) <= 40),
  CONSTRAINT agency_profile_website_chk CHECK (char_length(website) <= 200),
  CONSTRAINT agency_profile_billing_notes_chk CHECK (char_length(billing_notes) <= 1000)
);

COMMENT ON TABLE public.agency_profile IS
  'Datos legales de la propia agencia (una fila por org). Lo gestiona owner/admin de la org.';

ALTER TABLE public.agency_profile ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_profile TO authenticated;
GRANT ALL ON public.agency_profile TO service_role;

DROP POLICY IF EXISTS "agency_profile select" ON public.agency_profile;
CREATE POLICY "agency_profile select" ON public.agency_profile
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "agency_profile insert" ON public.agency_profile;
CREATE POLICY "agency_profile insert" ON public.agency_profile
  FOR INSERT TO authenticated WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "agency_profile update" ON public.agency_profile;
CREATE POLICY "agency_profile update" ON public.agency_profile
  FOR UPDATE TO authenticated USING (public.is_org_manager(org_id))
  WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "agency_profile delete" ON public.agency_profile;
CREATE POLICY "agency_profile delete" ON public.agency_profile
  FOR DELETE TO authenticated USING (public.is_org_manager(org_id));

DROP TRIGGER IF EXISTS t_agency_profile_u ON public.agency_profile;
CREATE TRIGGER t_agency_profile_u BEFORE UPDATE ON public.agency_profile
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------- cuentas bancarias

CREATE TABLE IF NOT EXISTS public.agency_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  bank_code text NOT NULL,
  account_type text NOT NULL,
  account_number text NOT NULL,
  holder_name text NOT NULL DEFAULT '',
  holder_rut text NOT NULL DEFAULT '',
  holder_email text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  is_primary boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_bank_bank_code_chk CHECK (
    bank_code IN (
      'banco_estado','bci','banco_de_chile','santander','scotiabank','itau',
      'falabella','security','bice','consorcio','internacional','ripley','hsbc','coopeuch'
    )
  ),
  CONSTRAINT agency_bank_account_type_chk CHECK (
    account_type IN ('corriente','vista','ahorro','rut')
  ),
  CONSTRAINT agency_bank_number_chk CHECK (char_length(btrim(account_number)) BETWEEN 1 AND 40),
  CONSTRAINT agency_bank_holder_chk CHECK (char_length(holder_name) <= 160),
  CONSTRAINT agency_bank_holder_rut_chk CHECK (char_length(holder_rut) <= 20),
  CONSTRAINT agency_bank_holder_email_chk CHECK (char_length(holder_email) <= 200),
  CONSTRAINT agency_bank_label_chk CHECK (char_length(label) <= 80),
  CONSTRAINT agency_bank_notes_chk CHECK (char_length(notes) <= 500)
);

COMMENT ON TABLE public.agency_bank_accounts IS
  'Cuentas bancarias de la agencia para recibir transferencias de clientes.';

CREATE INDEX IF NOT EXISTS agency_bank_accounts_org_idx
  ON public.agency_bank_accounts (org_id, created_at DESC);

ALTER TABLE public.agency_bank_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_bank_accounts TO authenticated;
GRANT ALL ON public.agency_bank_accounts TO service_role;

DROP POLICY IF EXISTS "agency_bank_accounts select" ON public.agency_bank_accounts;
CREATE POLICY "agency_bank_accounts select" ON public.agency_bank_accounts
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "agency_bank_accounts insert" ON public.agency_bank_accounts;
CREATE POLICY "agency_bank_accounts insert" ON public.agency_bank_accounts
  FOR INSERT TO authenticated WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "agency_bank_accounts update" ON public.agency_bank_accounts;
CREATE POLICY "agency_bank_accounts update" ON public.agency_bank_accounts
  FOR UPDATE TO authenticated USING (public.is_org_manager(org_id))
  WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "agency_bank_accounts delete" ON public.agency_bank_accounts;
CREATE POLICY "agency_bank_accounts delete" ON public.agency_bank_accounts
  FOR DELETE TO authenticated USING (public.is_org_manager(org_id));

DROP TRIGGER IF EXISTS t_agency_bank_accounts_u ON public.agency_bank_accounts;
CREATE TRIGGER t_agency_bank_accounts_u BEFORE UPDATE ON public.agency_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- --------------------------------------------------------------- RRHH extra

CREATE TABLE IF NOT EXISTS public.agency_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  -- Enlaza con un miembro de la plataforma (org_members.user_id). Puede ser
  -- NULL cuando el dueño registra a alguien que todavía no tiene cuenta.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  started_at date,
  ended_at date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_employees_name_chk CHECK (char_length(display_name) <= 160),
  CONSTRAINT agency_employees_title_chk CHECK (char_length(title) <= 120),
  CONSTRAINT agency_employees_area_chk CHECK (char_length(area) <= 120),
  CONSTRAINT agency_employees_phone_chk CHECK (char_length(phone) <= 40),
  CONSTRAINT agency_employees_email_chk CHECK (char_length(email) <= 200),
  CONSTRAINT agency_employees_notes_chk CHECK (char_length(notes) <= 1000),
  CONSTRAINT agency_employees_dates_chk CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

COMMENT ON TABLE public.agency_employees IS
  'Datos de RRHH que el dueño agrega sobre los miembros de la agencia (cargo, teléfono, antigüedad). Los usuarios de la plataforma siguen en org_members.';

CREATE INDEX IF NOT EXISTS agency_employees_org_idx
  ON public.agency_employees (org_id);
CREATE INDEX IF NOT EXISTS agency_employees_user_idx
  ON public.agency_employees (org_id, user_id);

ALTER TABLE public.agency_employees ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_employees TO authenticated;
GRANT ALL ON public.agency_employees TO service_role;

DROP POLICY IF EXISTS "agency_employees select" ON public.agency_employees;
CREATE POLICY "agency_employees select" ON public.agency_employees
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "agency_employees insert" ON public.agency_employees;
CREATE POLICY "agency_employees insert" ON public.agency_employees
  FOR INSERT TO authenticated WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "agency_employees update" ON public.agency_employees;
CREATE POLICY "agency_employees update" ON public.agency_employees
  FOR UPDATE TO authenticated USING (public.is_org_manager(org_id))
  WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "agency_employees delete" ON public.agency_employees;
CREATE POLICY "agency_employees delete" ON public.agency_employees
  FOR DELETE TO authenticated USING (public.is_org_manager(org_id));

DROP TRIGGER IF EXISTS t_agency_employees_u ON public.agency_employees;
CREATE TRIGGER t_agency_employees_u BEFORE UPDATE ON public.agency_employees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------------------ gastos

CREATE TABLE IF NOT EXISTS public.agency_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  expense_date date NOT NULL,
  supplier text NOT NULL DEFAULT '',
  concept text NOT NULL,
  category text NOT NULL DEFAULT 'otros',
  net_amount integer NOT NULL DEFAULT 0,
  iva_amount integer NOT NULL DEFAULT 0,
  total_amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CLP',
  document_type text NOT NULL DEFAULT 'boleta',
  document_number text NOT NULL DEFAULT '',
  payment_method text NOT NULL DEFAULT 'tarjeta_personal',
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_expenses_supplier_chk CHECK (char_length(supplier) <= 160),
  CONSTRAINT agency_expenses_concept_chk CHECK (char_length(btrim(concept)) BETWEEN 1 AND 200),
  CONSTRAINT agency_expenses_category_chk CHECK (
    category IN ('suscripciones','servicios','sueldos','marketing','honorarios','infraestructura','otros')
  ),
  CONSTRAINT agency_expenses_net_chk CHECK (net_amount >= 0 AND net_amount <= 2000000000),
  CONSTRAINT agency_expenses_iva_chk CHECK (iva_amount >= 0 AND iva_amount <= 2000000000),
  CONSTRAINT agency_expenses_total_chk CHECK (total_amount >= 0 AND total_amount <= 2000000000),
  CONSTRAINT agency_expenses_currency_chk CHECK (char_length(currency) BETWEEN 3 AND 3),
  CONSTRAINT agency_expenses_document_type_chk CHECK (
    document_type IN ('boleta','factura','otro')
  ),
  CONSTRAINT agency_expenses_document_number_chk CHECK (char_length(document_number) <= 40),
  CONSTRAINT agency_expenses_payment_method_chk CHECK (
    payment_method IN ('tarjeta_personal','tarjeta_empresa','transferencia','efectivo','otro')
  ),
  CONSTRAINT agency_expenses_notes_chk CHECK (char_length(notes) <= 1000)
);

COMMENT ON TABLE public.agency_expenses IS
  'Gastos de la agencia (suscripciones, servicios, honorarios). Se declaran manualmente; el IVA crédito se calcula desde iva_amount.';

CREATE INDEX IF NOT EXISTS agency_expenses_org_date_idx
  ON public.agency_expenses (org_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS agency_expenses_org_category_idx
  ON public.agency_expenses (org_id, category);

ALTER TABLE public.agency_expenses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agency_expenses TO authenticated;
GRANT ALL ON public.agency_expenses TO service_role;

DROP POLICY IF EXISTS "agency_expenses select" ON public.agency_expenses;
CREATE POLICY "agency_expenses select" ON public.agency_expenses
  FOR SELECT TO authenticated USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "agency_expenses insert" ON public.agency_expenses;
CREATE POLICY "agency_expenses insert" ON public.agency_expenses
  FOR INSERT TO authenticated WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "agency_expenses update" ON public.agency_expenses;
CREATE POLICY "agency_expenses update" ON public.agency_expenses
  FOR UPDATE TO authenticated USING (public.is_org_manager(org_id))
  WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "agency_expenses delete" ON public.agency_expenses;
CREATE POLICY "agency_expenses delete" ON public.agency_expenses
  FOR DELETE TO authenticated USING (public.is_org_manager(org_id));

DROP TRIGGER IF EXISTS t_agency_expenses_u ON public.agency_expenses;
CREATE TRIGGER t_agency_expenses_u BEFORE UPDATE ON public.agency_expenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
