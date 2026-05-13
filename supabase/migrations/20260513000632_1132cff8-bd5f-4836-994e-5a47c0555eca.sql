
-- Enums
DO $$ BEGIN
  CREATE TYPE public.objective_priority AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.objective_category AS ENUM ('growth','engagement','sales','branding','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.deliverable_type AS ENUM ('post','reel','story','design','meeting','report','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Objectives extras
ALTER TABLE public.objectives
  ADD COLUMN IF NOT EXISTS priority public.objective_priority NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS category public.objective_category NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS target_value numeric,
  ADD COLUMN IF NOT EXISTS current_value numeric,
  ADD COLUMN IF NOT EXISTS unit text;

-- Deliverables extras
ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS type public.deliverable_type NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS instagram_post_id uuid,
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
