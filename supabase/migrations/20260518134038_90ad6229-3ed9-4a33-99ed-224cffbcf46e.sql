
-- Campaigns
ALTER TABLE public.meta_ads_campaigns
  ADD COLUMN IF NOT EXISTS buying_type text NOT NULL DEFAULT 'AUCTION',
  ADD COLUMN IF NOT EXISTS bid_strategy text,
  ADD COLUMN IF NOT EXISTS cbo_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spend_cap numeric;

-- Ad sets
ALTER TABLE public.meta_ads_adsets
  ADD COLUMN IF NOT EXISTS start_time timestamptz,
  ADD COLUMN IF NOT EXISTS end_time timestamptz,
  ADD COLUMN IF NOT EXISTS bid_amount numeric,
  ADD COLUMN IF NOT EXISTS cities text,
  ADD COLUMN IF NOT EXISTS languages text,
  ADD COLUMN IF NOT EXISTS behaviors text,
  ADD COLUMN IF NOT EXISTS demographics text,
  ADD COLUMN IF NOT EXISTS custom_audiences text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lookalike_audiences text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS excluded_audiences text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS placement_mode text NOT NULL DEFAULT 'automatic',
  ADD COLUMN IF NOT EXISTS device_platforms text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS user_os text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS wifi_only boolean NOT NULL DEFAULT false;

-- Ads
ALTER TABLE public.meta_ads_ads
  ADD COLUMN IF NOT EXISTS page_id text,
  ADD COLUMN IF NOT EXISTS instagram_actor_id text,
  ADD COLUMN IF NOT EXISTS display_url text,
  ADD COLUMN IF NOT EXISTS utm_params jsonb,
  ADD COLUMN IF NOT EXISTS carousel_cards jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS optimize_carousel_order boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS multi_share_end_card boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fb_creative_id text,
  ADD COLUMN IF NOT EXISTS fb_adset_id text;
