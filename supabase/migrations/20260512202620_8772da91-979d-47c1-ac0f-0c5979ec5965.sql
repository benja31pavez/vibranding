ALTER TABLE public.instagram_profiles
  ADD COLUMN IF NOT EXISTS current_contact_phone text,
  ADD COLUMN IF NOT EXISTS proposed_contact_phone text,
  ADD COLUMN IF NOT EXISTS current_contact_email text,
  ADD COLUMN IF NOT EXISTS proposed_contact_email text;