ALTER TABLE public.instagram_posts ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DROP INDEX IF EXISTS public.instagram_posts_client_media_uk;
DROP INDEX IF EXISTS public.instagram_posts_client_id_ig_media_id_key;
DROP INDEX IF EXISTS public.uq_instagram_posts_client_ig_media;

CREATE UNIQUE INDEX IF NOT EXISTS instagram_posts_client_ig_media_uk
  ON public.instagram_posts (client_id, ig_media_id);

CREATE INDEX IF NOT EXISTS instagram_posts_archived_at_idx
  ON public.instagram_posts (client_id, archived_at);