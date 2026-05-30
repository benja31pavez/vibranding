-- 1) Service pricing: one row per (user_id, service_key)
CREATE TABLE public.service_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_key text NOT NULL CHECK (service_key IN ('branding','optimization','content','ads','landing','chatbot')),
  one_time_price numeric NOT NULL DEFAULT 0,
  monthly_price numeric NOT NULL DEFAULT 0,
  included_text text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_pricing TO authenticated;
GRANT ALL ON public.service_pricing TO service_role;

ALTER TABLE public.service_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own service_pricing select" ON public.service_pricing
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own service_pricing insert" ON public.service_pricing
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own service_pricing update" ON public.service_pricing
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own service_pricing delete" ON public.service_pricing
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER service_pricing_touch
  BEFORE UPDATE ON public.service_pricing
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Contract template fields on pricing_settings (shared per agency/user)
ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS agency_legal_name text,
  ADD COLUMN IF NOT EXISTS agency_tax_id text,
  ADD COLUMN IF NOT EXISTS agency_address text,
  ADD COLUMN IF NOT EXISTS agency_email text,
  ADD COLUMN IF NOT EXISTS payment_due_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS clause_esim text,
  ADD COLUMN IF NOT EXISTS clause_meta_api text,
  ADD COLUMN IF NOT EXISTS clause_late_payment text,
  ADD COLUMN IF NOT EXISTS clause_extra text,
  ADD COLUMN IF NOT EXISTS jurisdiction text;

-- 3) Client contracts
CREATE TYPE public.contract_status AS ENUM ('draft','sent','signed','cancelled');

CREATE TABLE public.client_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Contrato de servicios',
  status public.contract_status NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'EUR',
  payment_due_days integer NOT NULL DEFAULT 30,
  -- snapshot of agency + client at generation time
  agency_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- selected services snapshot (array of {service_key,label,one_time_price,monthly_price,included_text})
  services_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  clauses_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_one_time numeric NOT NULL DEFAULT 0,
  total_monthly numeric NOT NULL DEFAULT 0,
  effective_date date,
  signed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_contracts_client_idx ON public.client_contracts(client_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contracts TO authenticated;
GRANT ALL ON public.client_contracts TO service_role;

ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own client_contracts select" ON public.client_contracts
  FOR SELECT TO authenticated USING (public.owns_client(client_id));
CREATE POLICY "own client_contracts insert" ON public.client_contracts
  FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));
CREATE POLICY "own client_contracts update" ON public.client_contracts
  FOR UPDATE TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "own client_contracts delete" ON public.client_contracts
  FOR DELETE TO authenticated USING (public.owns_client(client_id));

CREATE TRIGGER client_contracts_touch
  BEFORE UPDATE ON public.client_contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();