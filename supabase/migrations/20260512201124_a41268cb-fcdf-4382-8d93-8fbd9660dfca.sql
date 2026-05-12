ALTER TABLE public.instagram_profiles
ADD COLUMN IF NOT EXISTS current_show_contact_button boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS proposed_show_contact_button boolean NOT NULL DEFAULT false;