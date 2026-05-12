ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS music text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.instagram_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.instagram_posts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  username text NOT NULL DEFAULT '',
  text text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instagram_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel" ON public.instagram_post_comments FOR SELECT TO authenticated USING (public.owns_client(client_id));
CREATE POLICY "ins" ON public.instagram_post_comments FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));
CREATE POLICY "upd" ON public.instagram_post_comments FOR UPDATE TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));
CREATE POLICY "del" ON public.instagram_post_comments FOR DELETE TO authenticated USING (public.owns_client(client_id));

CREATE INDEX IF NOT EXISTS idx_ig_comments_post ON public.instagram_post_comments(post_id);