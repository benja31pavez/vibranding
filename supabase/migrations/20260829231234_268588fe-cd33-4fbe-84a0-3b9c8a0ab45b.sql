ALTER TABLE public.multilinks
  ADD COLUMN IF NOT EXISTS button_style text NOT NULL DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS button_shape text NOT NULL DEFAULT 'rounded',
  ADD COLUMN IF NOT EXISTS font_family text NOT NULL DEFAULT 'geometric',
  ADD COLUMN IF NOT EXISTS background jsonb NOT NULL DEFAULT '{"type":"flat"}'::jsonb;

ALTER TABLE public.multilinks
  DROP CONSTRAINT IF EXISTS multilinks_button_style_check,
  DROP CONSTRAINT IF EXISTS multilinks_button_shape_check,
  DROP CONSTRAINT IF EXISTS multilinks_font_family_check;

ALTER TABLE public.multilinks
  ADD CONSTRAINT multilinks_button_style_check CHECK (button_style IN ('solid','outline','soft','hard-shadow','glass')),
  ADD CONSTRAINT multilinks_button_shape_check CHECK (button_shape IN ('rounded','pill','square')),
  ADD CONSTRAINT multilinks_font_family_check CHECK (font_family IN ('geometric','grotesque','serif','rounded'));