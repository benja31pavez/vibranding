
-- Post format enum
CREATE TYPE public.post_format AS ENUM ('photo', 'carousel', 'reel');

ALTER TABLE public.instagram_posts
  ADD COLUMN format public.post_format NOT NULL DEFAULT 'photo';

-- Highlights table
CREATE TABLE public.instagram_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  type public.ig_post_type NOT NULL,
  position integer NOT NULL DEFAULT 0,
  title text,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel" ON public.instagram_highlights FOR SELECT TO authenticated USING (owns_client(client_id));
CREATE POLICY "ins" ON public.instagram_highlights FOR INSERT TO authenticated WITH CHECK (owns_client(client_id));
CREATE POLICY "upd" ON public.instagram_highlights FOR UPDATE TO authenticated USING (owns_client(client_id)) WITH CHECK (owns_client(client_id));
CREATE POLICY "del" ON public.instagram_highlights FOR DELETE TO authenticated USING (owns_client(client_id));

CREATE TRIGGER touch_highlights BEFORE UPDATE ON public.instagram_highlights
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage bucket for client media (avatars, posts, highlights)
INSERT INTO storage.buckets (id, name, public) VALUES ('client-media', 'client-media', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "client-media public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'client-media');

CREATE POLICY "client-media auth insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "client-media auth update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'client-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "client-media auth delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'client-media' AND (storage.foldername(name))[1] = auth.uid()::text);
