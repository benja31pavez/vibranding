ALTER TABLE public.instagram_profiles
  ADD COLUMN IF NOT EXISTS current_display_name TEXT,
  ADD COLUMN IF NOT EXISTS proposed_display_name TEXT;