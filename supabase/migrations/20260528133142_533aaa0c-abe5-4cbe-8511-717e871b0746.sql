CREATE TABLE public.multilinks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  bio text,
  avatar_url text,
  theme_color text NOT NULL DEFAULT '#6366f1',
  theme_mode text NOT NULL DEFAULT 'light',
  published boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.multilink_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  multilink_id uuid NOT NULL REFERENCES public.multilinks(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  click_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  published boolean NOT NULL DEFAULT false,
  theme_color text NOT NULL DEFAULT '#6366f1',
  hero_title text NOT NULL DEFAULT '',
  hero_subtitle text,
  hero_image_url text,
  cta_text text,
  cta_url text,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  contact_enabled boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.landing_contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_id uuid NOT NULL REFERENCES public.landing_pages(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.multilinks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.multilinks TO authenticated;
GRANT ALL ON public.multilinks TO service_role;

GRANT SELECT ON public.multilink_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.multilink_items TO authenticated;
GRANT ALL ON public.multilink_items TO service_role;

GRANT SELECT ON public.landing_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.landing_pages TO authenticated;
GRANT ALL ON public.landing_pages TO service_role;

GRANT INSERT ON public.landing_contact_submissions TO anon;
GRANT SELECT, INSERT, DELETE ON public.landing_contact_submissions TO authenticated;
GRANT ALL ON public.landing_contact_submissions TO service_role;

ALTER TABLE public.multilinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.multilink_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner all multilinks" ON public.multilinks FOR ALL TO authenticated
  USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "public view published multilinks" ON public.multilinks FOR SELECT TO anon, authenticated
  USING (published = true);

CREATE POLICY "owner all multilink_items" ON public.multilink_items FOR ALL TO authenticated
  USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "public view items of published multilinks" ON public.multilink_items FOR SELECT TO anon, authenticated
  USING (is_active = true AND EXISTS (SELECT 1 FROM public.multilinks m WHERE m.id = multilink_items.multilink_id AND m.published = true));

CREATE POLICY "owner all landing_pages" ON public.landing_pages FOR ALL TO authenticated
  USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "public view published landing_pages" ON public.landing_pages FOR SELECT TO anon, authenticated
  USING (published = true);

CREATE POLICY "anon insert submissions on published" ON public.landing_contact_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.landing_pages lp WHERE lp.id = landing_id AND lp.published = true AND lp.client_id = landing_contact_submissions.client_id));
CREATE POLICY "owner view submissions" ON public.landing_contact_submissions FOR SELECT TO authenticated
  USING (public.owns_client(client_id));
CREATE POLICY "owner delete submissions" ON public.landing_contact_submissions FOR DELETE TO authenticated
  USING (public.owns_client(client_id));

CREATE TRIGGER trg_multilinks_upd BEFORE UPDATE ON public.multilinks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_landings_upd BEFORE UPDATE ON public.landing_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.increment_multilink_view(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.multilinks SET view_count = view_count + 1 WHERE id = _id AND published = true;
$$;
CREATE OR REPLACE FUNCTION public.increment_multilink_click(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.multilink_items SET click_count = click_count + 1 WHERE id = _id AND is_active = true;
$$;
CREATE OR REPLACE FUNCTION public.increment_landing_view(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.landing_pages SET view_count = view_count + 1 WHERE id = _id AND published = true;
$$;

GRANT EXECUTE ON FUNCTION public.increment_multilink_view(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_multilink_click(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_landing_view(uuid) TO anon, authenticated;