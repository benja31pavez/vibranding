DROP INDEX IF EXISTS public.instagram_posts_client_ig_media_uk;
DROP INDEX IF EXISTS public.instagram_posts_client_media_uniq;
CREATE UNIQUE INDEX instagram_posts_client_media_uniq
  ON public.instagram_posts (client_id, ig_media_id)
  WHERE ig_media_id IS NOT NULL AND version_id IS NULL;
CREATE UNIQUE INDEX instagram_posts_version_media_uniq
  ON public.instagram_posts (version_id, ig_media_id)
  WHERE ig_media_id IS NOT NULL AND version_id IS NOT NULL;