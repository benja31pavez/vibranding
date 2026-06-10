CREATE TABLE public.client_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('whatsapp','landing','meta_ads','multilink')),
  name TEXT NOT NULL,
  contact TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX client_leads_client_idx ON public.client_leads(client_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_leads TO authenticated;
GRANT ALL ON public.client_leads TO service_role;
ALTER TABLE public.client_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages client_leads" ON public.client_leads FOR ALL
USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_leads.client_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_leads.client_id AND c.user_id = auth.uid()));