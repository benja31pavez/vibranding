-- lead_meta guarda estado/notas/etiquetas de cada lead. Su CHECK original solo
-- aceptaba 'whatsapp' y 'landing', pero LeadsPage también hace upsert para los
-- leads de client_leads ('meta_ads', 'multilink'), que fallaban con violación de CHECK.
-- Idempotente: elimina cualquier CHECK previo sobre "source" y crea uno con las
-- mismas fuentes que client_leads.

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'lead_meta'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%source%'
  LOOP
    EXECUTE format('ALTER TABLE public.lead_meta DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.lead_meta
  ADD CONSTRAINT lead_meta_source_check
  CHECK (source IN ('whatsapp', 'landing', 'meta_ads', 'multilink'));
