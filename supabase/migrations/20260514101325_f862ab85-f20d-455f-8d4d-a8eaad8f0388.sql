CREATE TABLE public.deliverable_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deliverable_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel" ON public.deliverable_folders FOR SELECT TO authenticated USING (owns_client(client_id));
CREATE POLICY "ins" ON public.deliverable_folders FOR INSERT TO authenticated WITH CHECK (owns_client(client_id));
CREATE POLICY "upd" ON public.deliverable_folders FOR UPDATE TO authenticated USING (owns_client(client_id)) WITH CHECK (owns_client(client_id));
CREATE POLICY "del" ON public.deliverable_folders FOR DELETE TO authenticated USING (owns_client(client_id));

CREATE TRIGGER trg_deliverable_folders_updated BEFORE UPDATE ON public.deliverable_folders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.deliverables ADD COLUMN folder_id UUID REFERENCES public.deliverable_folders(id) ON DELETE SET NULL;
CREATE INDEX idx_deliverables_folder ON public.deliverables(folder_id);