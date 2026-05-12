DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM ('personal', 'business');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.instagram_profiles
  ADD COLUMN IF NOT EXISTS current_account_type public.account_type NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS proposed_account_type public.account_type NOT NULL DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS current_category text,
  ADD COLUMN IF NOT EXISTS proposed_category text,
  ADD COLUMN IF NOT EXISTS current_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proposed_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_threads_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proposed_threads_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_threads_handle text,
  ADD COLUMN IF NOT EXISTS proposed_threads_handle text,
  ADD COLUMN IF NOT EXISTS current_song_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proposed_song_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_song text,
  ADD COLUMN IF NOT EXISTS proposed_song text;

ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS is_trial_reel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS close_friends_only boolean NOT NULL DEFAULT false;