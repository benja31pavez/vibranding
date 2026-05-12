ALTER TABLE public.instagram_posts
  ADD COLUMN carousel_urls text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN cover_url text;