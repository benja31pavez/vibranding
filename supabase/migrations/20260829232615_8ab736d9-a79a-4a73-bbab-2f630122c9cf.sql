ALTER TABLE public.landing_pages
  ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS dark_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hero_aspect text NOT NULL DEFAULT 'square',
  ADD COLUMN IF NOT EXISTS testimonials_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS testimonials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS location_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS faq_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS footer jsonb NOT NULL DEFAULT '{}'::jsonb;