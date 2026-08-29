ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS ig_media_id text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS instagram_posts_client_media_uniq
  ON public.instagram_posts (client_id, ig_media_id)
  WHERE ig_media_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS instagram_posts_media_idx
  ON public.instagram_posts (ig_media_id)
  WHERE ig_media_id IS NOT NULL;

ALTER TABLE public.instagram_profiles
  ADD COLUMN IF NOT EXISTS current_synced_at timestamptz;