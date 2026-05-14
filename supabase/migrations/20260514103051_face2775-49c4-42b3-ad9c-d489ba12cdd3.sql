CREATE TABLE public.deliverable_dividers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  label text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deliverable_dividers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel" ON public.deliverable_dividers FOR SELECT TO authenticated USING (owns_client(client_id));
CREATE POLICY "ins" ON public.deliverable_dividers FOR INSERT TO authenticated WITH CHECK (owns_client(client_id));
CREATE POLICY "upd" ON public.deliverable_dividers FOR UPDATE TO authenticated USING (owns_client(client_id)) WITH CHECK (owns_client(client_id));
CREATE POLICY "del" ON public.deliverable_dividers FOR DELETE TO authenticated USING (owns_client(client_id));

CREATE TRIGGER touch_dividers BEFORE UPDATE ON public.deliverable_dividers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();