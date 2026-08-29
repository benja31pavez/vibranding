-- 1. Orgs and membership
CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orgs TO authenticated;
GRANT ALL ON public.orgs TO service_role;
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','agent','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER t_orgs_u BEFORE UPDATE ON public.orgs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_org_members_u BEFORE UPDATE ON public.org_members FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Membership helpers (SECURITY DEFINER to avoid recursive policy evaluation)
CREATE OR REPLACE FUNCTION public.user_orgs()
RETURNS TABLE(org_id uuid, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT m.org_id, m.role FROM public.org_members m WHERE m.user_id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS(SELECT 1 FROM public.org_members m WHERE m.user_id = auth.uid() AND m.org_id = _org_id) $$;

CREATE OR REPLACE FUNCTION public.is_org_manager(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS(SELECT 1 FROM public.org_members m WHERE m.user_id = auth.uid() AND m.org_id = _org_id AND m.role IN ('owner','admin')) $$;

-- 3. clients.org_id + backfill (one personal org per existing owner)
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE;

INSERT INTO public.orgs (name, owner_user_id)
SELECT 'Mi organización', c.user_id
FROM (SELECT DISTINCT user_id FROM public.clients) c
WHERE NOT EXISTS (SELECT 1 FROM public.orgs o WHERE o.owner_user_id = c.user_id);

INSERT INTO public.org_members (org_id, user_id, role)
SELECT o.id, o.owner_user_id, 'owner' FROM public.orgs o
ON CONFLICT (org_id, user_id) DO NOTHING;

UPDATE public.clients c
SET org_id = o.id
FROM public.orgs o
WHERE c.org_id IS NULL AND o.owner_user_id = c.user_id;

ALTER TABLE public.clients ALTER COLUMN org_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_org ON public.clients(org_id);

-- 4. RLS for orgs / org_members
DROP POLICY IF EXISTS "orgs select" ON public.orgs;
DROP POLICY IF EXISTS "orgs insert" ON public.orgs;
DROP POLICY IF EXISTS "orgs update" ON public.orgs;
DROP POLICY IF EXISTS "orgs delete" ON public.orgs;
CREATE POLICY "orgs select" ON public.orgs FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "orgs insert" ON public.orgs FOR INSERT TO authenticated WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "orgs update" ON public.orgs FOR UPDATE TO authenticated USING (public.is_org_manager(id)) WITH CHECK (public.is_org_manager(id));
CREATE POLICY "orgs delete" ON public.orgs FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "org_members select" ON public.org_members;
DROP POLICY IF EXISTS "org_members insert" ON public.org_members;
DROP POLICY IF EXISTS "org_members update" ON public.org_members;
DROP POLICY IF EXISTS "org_members delete" ON public.org_members;
CREATE POLICY "org_members select" ON public.org_members FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "org_members insert" ON public.org_members FOR INSERT TO authenticated WITH CHECK (public.is_org_manager(org_id));
CREATE POLICY "org_members update" ON public.org_members FOR UPDATE TO authenticated USING (public.is_org_manager(org_id)) WITH CHECK (public.is_org_manager(org_id));
CREATE POLICY "org_members delete" ON public.org_members FOR DELETE TO authenticated USING (public.is_org_manager(org_id));

-- 5. Read-only client users (created before the policies that reference them)
CREATE TABLE IF NOT EXISTS public.client_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_users TO authenticated;
GRANT ALL ON public.client_users TO service_role;
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER t_client_users_u BEFORE UPDATE ON public.client_users FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.user_client_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT cu.client_id FROM public.client_users cu WHERE cu.user_id = auth.uid() LIMIT 1 $$;

-- 6. Tenancy now flows through org membership everywhere owns_client() is used
CREATE OR REPLACE FUNCTION public.owns_client(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.clients c
    WHERE c.id = _client_id
      AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = c.org_id AND m.user_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.manages_client(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.clients c
    JOIN public.org_members m ON m.org_id = c.org_id
    WHERE c.id = _client_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
  )
$$;

-- clients table itself
DROP POLICY IF EXISTS "own clients select" ON public.clients;
DROP POLICY IF EXISTS "own clients insert" ON public.clients;
DROP POLICY IF EXISTS "own clients update" ON public.clients;
DROP POLICY IF EXISTS "own clients delete" ON public.clients;
CREATE POLICY "clients select" ON public.clients FOR SELECT TO authenticated
  USING (public.is_org_member(org_id) OR id = public.user_client_id());
CREATE POLICY "clients insert" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(org_id));
CREATE POLICY "clients update" ON public.clients FOR UPDATE TO authenticated
  USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
CREATE POLICY "clients delete" ON public.clients FOR DELETE TO authenticated
  USING (public.is_org_manager(org_id));

-- 7. client_users policies
CREATE POLICY "client_users select" ON public.client_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.owns_client(client_id));
CREATE POLICY "client_users insert" ON public.client_users FOR INSERT TO authenticated
  WITH CHECK (public.manages_client(client_id));
CREATE POLICY "client_users update" ON public.client_users FOR UPDATE TO authenticated
  USING (public.manages_client(client_id)) WITH CHECK (public.manages_client(client_id));
CREATE POLICY "client_users delete" ON public.client_users FOR DELETE TO authenticated
  USING (public.manages_client(client_id));

-- read-only surfaces for the invited client user
CREATE POLICY "client user reads deliverables" ON public.deliverables FOR SELECT TO authenticated
  USING (client_id = public.user_client_id());
CREATE POLICY "client user reads deliverable_folders" ON public.deliverable_folders FOR SELECT TO authenticated
  USING (client_id = public.user_client_id());
CREATE POLICY "client user reads deliverable_dividers" ON public.deliverable_dividers FOR SELECT TO authenticated
  USING (client_id = public.user_client_id());
CREATE POLICY "client user reads objectives" ON public.objectives FOR SELECT TO authenticated
  USING (client_id = public.user_client_id());

-- 8. Sensitive tables: only owners/admins may modify
DROP POLICY IF EXISTS "own client_contracts update" ON public.client_contracts;
DROP POLICY IF EXISTS "own client_contracts delete" ON public.client_contracts;
CREATE POLICY "own client_contracts update" ON public.client_contracts FOR UPDATE TO authenticated
  USING (public.manages_client(client_id)) WITH CHECK (public.manages_client(client_id));
CREATE POLICY "own client_contracts delete" ON public.client_contracts FOR DELETE TO authenticated
  USING (public.manages_client(client_id));

DROP POLICY IF EXISTS "payments update" ON public.payments;
DROP POLICY IF EXISTS "payments delete" ON public.payments;
DROP POLICY IF EXISTS "own payments update" ON public.payments;
DROP POLICY IF EXISTS "own payments delete" ON public.payments;
CREATE POLICY "payments update" ON public.payments FOR UPDATE TO authenticated
  USING (public.manages_client(client_id)) WITH CHECK (public.manages_client(client_id));
CREATE POLICY "payments delete" ON public.payments FOR DELETE TO authenticated
  USING (public.manages_client(client_id));

-- 9. Analytics reachable for org members and the invited client user only
CREATE OR REPLACE FUNCTION public.client_analytics_guard(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT public.owns_client(_client_id) OR _client_id = public.user_client_id() $$;
