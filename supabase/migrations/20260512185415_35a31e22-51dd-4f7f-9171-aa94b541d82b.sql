ALTER TABLE public.instagram_profiles
  ADD COLUMN IF NOT EXISTS proposed_followers integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proposed_following integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proposed_posts_count integer DEFAULT 0;