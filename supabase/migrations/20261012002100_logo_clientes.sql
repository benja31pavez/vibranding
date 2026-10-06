-- =====================================================================
-- Logo del cliente (PR feat/logo-cliente-instagram)
--
-- clients.logo_url / logo_source / logo_updated_at. El servidor obtiene el
-- logo desde la foto de perfil de Instagram (API oficial) o lo recibe subido
-- a mano, lo guarda en el bucket público client-media (logos/<client_id>/…)
-- con service_role y escribe estas columnas.
--
-- Lectura: igual que el resto de clients (miembros de la org y el portal del
-- propio cliente, por las policies existentes). Escritura de estas columnas:
-- solo service_role. Un trigger impide que el navegador (anon/authenticated)
-- las cambie: así nadie apunta logo_url a una URL arbitraria.
-- Storage: no se tocan buckets ni policies. service_role ignora RLS en
-- storage.objects y client-media ya es público para lectura.
-- Idempotente: se puede correr más de una vez.
-- =====================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS logo_source text,
  ADD COLUMN IF NOT EXISTS logo_updated_at timestamptz;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_logo_source_chk;
ALTER TABLE public.clients ADD CONSTRAINT clients_logo_source_chk
  CHECK (logo_source IS NULL OR logo_source IN ('instagram', 'manual'));

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_logo_url_chk;
ALTER TABLE public.clients ADD CONSTRAINT clients_logo_url_chk
  CHECK (logo_url IS NULL OR (logo_url LIKE 'https://%' AND length(logo_url) <= 1000));

COMMENT ON COLUMN public.clients.logo_url IS
  'URL pública del logo (client-media/logos/<client_id>/<hash>.<ext>). Escribe solo service_role.';
COMMENT ON COLUMN public.clients.logo_source IS
  '''instagram'' (foto de perfil, se refresca cada semana) o ''manual'' (subido a mano; el cron no lo pisa).';
COMMENT ON COLUMN public.clients.logo_updated_at IS
  'Última vez que se guardó el logo.';

-- Índice parcial para el cron semanal (candidatos: logos de Instagram y clientes con @ sin logo).
CREATE INDEX IF NOT EXISTS clients_logo_refresh_idx
  ON public.clients (id)
  WHERE logo_source = 'instagram' OR (logo_source IS NULL AND instagram_handle IS NOT NULL);

-- Solo el servidor (service_role) o un admin en SQL puede cambiar las columnas del logo.
CREATE OR REPLACE FUNCTION public.guard_client_logo_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.logo_url := NULL;
    NEW.logo_source := NULL;
    NEW.logo_updated_at := NULL;
    RETURN NEW;
  END IF;
  IF NEW.logo_url IS DISTINCT FROM OLD.logo_url
     OR NEW.logo_source IS DISTINCT FROM OLD.logo_source
     OR NEW.logo_updated_at IS DISTINCT FROM OLD.logo_updated_at THEN
    RAISE EXCEPTION 'El logo del cliente solo se cambia desde la plataforma'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_client_logo_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_clients_logo_guard ON public.clients;
CREATE TRIGGER t_clients_logo_guard
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.guard_client_logo_columns();
