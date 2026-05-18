
-- Public portfolio: clients shown on the landing
CREATE TABLE public.portfolio_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  logo_url text,
  description text,
  website_url text,
  industry text,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portfolio_clients_user_sort_idx ON public.portfolio_clients (user_id, sort_order);
CREATE INDEX portfolio_clients_visible_idx ON public.portfolio_clients (is_visible, sort_order);

ALTER TABLE public.portfolio_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view visible portfolio clients"
ON public.portfolio_clients FOR SELECT
TO anon, authenticated
USING (is_visible = true OR user_id = auth.uid());

CREATE POLICY "Owner can insert portfolio clients"
ON public.portfolio_clients FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner can update portfolio clients"
ON public.portfolio_clients FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner can delete portfolio clients"
ON public.portfolio_clients FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER portfolio_clients_touch
BEFORE UPDATE ON public.portfolio_clients
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Works attached to each portfolio client
CREATE TABLE public.portfolio_works (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_client_id uuid NOT NULL REFERENCES public.portfolio_clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text,
  description text,
  image_url text,
  link_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portfolio_works_client_sort_idx ON public.portfolio_works (portfolio_client_id, sort_order);

ALTER TABLE public.portfolio_works ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view visible portfolio works"
ON public.portfolio_works FOR SELECT
TO anon, authenticated
USING (
  is_visible = true OR user_id = auth.uid()
);

CREATE POLICY "Owner can insert portfolio works"
ON public.portfolio_works FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner can update portfolio works"
ON public.portfolio_works FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owner can delete portfolio works"
ON public.portfolio_works FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER portfolio_works_touch
BEFORE UPDATE ON public.portfolio_works
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage policies so the owner can upload portfolio assets to client-media bucket
CREATE POLICY "Public can read portfolio media"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'client-media');

CREATE POLICY "Authenticated can upload portfolio media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client-media' AND (storage.foldername(name))[1] = 'portfolio');

CREATE POLICY "Authenticated can update portfolio media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'client-media' AND (storage.foldername(name))[1] = 'portfolio');

CREATE POLICY "Authenticated can delete portfolio media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'client-media' AND (storage.foldername(name))[1] = 'portfolio');
