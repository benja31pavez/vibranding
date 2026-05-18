ALTER TABLE public.meta_ads_adsets
  ADD COLUMN IF NOT EXISTS interests text,
  ADD COLUMN IF NOT EXISTS placements text[] NOT NULL DEFAULT '{}'::text[];