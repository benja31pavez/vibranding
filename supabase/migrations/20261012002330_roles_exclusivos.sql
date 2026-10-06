-- =====================================================================
-- Fase 0 · 4/5 — Un usuario cliente nunca es miembro de una org
-- =====================================================================
-- Registro hoy (documentado): cualquiera puede crear una cuenta en /login
-- (email o Google). La cuenta nueva NO pertenece a ninguna org hasta que el
-- front llama ensure_org() (al crear su primer cliente en NewClientDialog o
-- al cargar prospectos en prospectsData), que la deja como OWNER de una org
-- nueva y vacía ("Mi organización"). Por eso "tener org" NO significa "ser la
-- agencia Vibranding": toda autorización debe ser "miembro de la org DEL
-- cliente X" (can_edit_client / getClientOrgRole), nunca "tiene org".
--
-- Problema (H11): un usuario invitado como cliente (fila en client_users)
-- también podía llamar ensure_org() y quedar owner de una org propia, lo que
-- rompe el invariante "cliente XOR agencia" en el que se apoyan el guard del
-- panel y el portal.
--
-- Cambio:
--   1. ensure_org() rechaza a usuarios cliente (user_client_id() no nulo).
--      Para el owner actual no cambia nada: ya es miembro y la función
--      devuelve su org en la primera consulta.
--   2. Policy "orgs insert": además exige que el usuario no sea cliente.
--   3. Triggers de exclusión mutua: no se puede insertar en org_members un
--      user_id que esté en client_users, ni al revés. (inviteClientUser ya
--      lo valida en el servidor; esto lo garantiza en la base.)
--
-- Datos actuales (2026-10-06): 0 client_users, 1 org_member → no hay
-- conflictos existentes. Re-ejecutable.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.ensure_org()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE uid uuid := auth.uid(); oid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT m.org_id INTO oid FROM public.org_members m WHERE m.user_id = uid LIMIT 1;
  IF oid IS NOT NULL THEN RETURN oid; END IF;

  -- Un usuario invitado como cliente no puede crear una organización.
  IF EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.user_id = uid) THEN
    RAISE EXCEPTION 'client users cannot create organizations' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.orgs (name, owner_user_id) VALUES ('Mi organización', uid) RETURNING id INTO oid;
  INSERT INTO public.org_members (org_id, user_id, role) VALUES (oid, uid, 'owner');
  RETURN oid;
END $$;

REVOKE ALL ON FUNCTION public.ensure_org() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_org() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- Exclusión mutua client_users ⟂ org_members
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_user_kind_exclusive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'org_members' THEN
    IF EXISTS (SELECT 1 FROM public.client_users cu WHERE cu.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'este usuario es cliente y no puede ser miembro de una organización'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'client_users' THEN
    IF EXISTS (SELECT 1 FROM public.org_members m WHERE m.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'este usuario es miembro de una organización y no puede ser cliente'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.enforce_user_kind_exclusive() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_org_members_user_kind ON public.org_members;
CREATE TRIGGER t_org_members_user_kind
  BEFORE INSERT OR UPDATE OF user_id ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_kind_exclusive();

DROP TRIGGER IF EXISTS t_client_users_user_kind ON public.client_users;
CREATE TRIGGER t_client_users_user_kind
  BEFORE INSERT OR UPDATE OF user_id ON public.client_users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_kind_exclusive();

-- ---------------------------------------------------------------------
-- orgs insert: un usuario cliente tampoco puede crear una org a mano por la
-- API (sin pasar por ensure_org). user_client_id() es SECURITY DEFINER.
-- (Aunque la insertara, el trigger de org_members le impediría ser miembro;
-- esto evita además orgs huérfanas.)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "orgs insert" ON public.orgs;
CREATE POLICY "orgs insert" ON public.orgs
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND public.user_client_id() IS NULL);

NOTIFY pgrst, 'reload schema';
