-- Item types, featured cards and scheduling ------------------------------
ALTER TABLE public.multilink_items
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'link',
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtitle text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS wa_number text,
  ADD COLUMN IF NOT EXISTS wa_message text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz;

ALTER TABLE public.multilink_items
  DROP CONSTRAINT IF EXISTS multilink_items_kind_chk;
ALTER TABLE public.multilink_items
  ADD CONSTRAINT multilink_items_kind_chk
  CHECK (kind IN ('link', 'whatsapp', 'video'));

CREATE INDEX IF NOT EXISTS multilink_items_schedule_idx
  ON public.multilink_items (multilink_id, is_active, start_at, end_at);

-- Custom domain per client multilink --------------------------------------
ALTER TABLE public.multilinks
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS custom_domain_verified boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS multilinks_custom_domain_uk
  ON public.multilinks (lower(custom_domain))
  WHERE custom_domain IS NOT NULL;