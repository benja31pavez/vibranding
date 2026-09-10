CREATE TABLE public.client_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee TEXT,
  status public.task_status NOT NULL DEFAULT 'pending',
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_tasks_client ON public.client_tasks(client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_tasks TO authenticated;
GRANT ALL ON public.client_tasks TO service_role;
ALTER TABLE public.client_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel" ON public.client_tasks FOR SELECT TO authenticated USING (public.owns_client(client_id));
CREATE POLICY "ins" ON public.client_tasks FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));
CREATE POLICY "upd" ON public.client_tasks FOR UPDATE TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "del" ON public.client_tasks FOR DELETE TO authenticated USING (public.owns_client(client_id));
CREATE POLICY "client user reads client_tasks" ON public.client_tasks FOR SELECT TO authenticated USING (client_id = public.user_client_id());
CREATE TRIGGER t_client_tasks_u BEFORE UPDATE ON public.client_tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();