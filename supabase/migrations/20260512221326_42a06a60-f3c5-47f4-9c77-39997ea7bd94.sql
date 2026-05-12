-- Meta Ads schema
CREATE TYPE public.meta_campaign_objective AS ENUM (
  'OUTCOME_AWARENESS','OUTCOME_TRAFFIC','OUTCOME_ENGAGEMENT','OUTCOME_LEADS','OUTCOME_APP_PROMOTION','OUTCOME_SALES'
);
CREATE TYPE public.meta_status AS ENUM ('ACTIVE','PAUSED','DELETED','ARCHIVED','DRAFT');
CREATE TYPE public.meta_placement AS ENUM ('feed','stories','reels','marketplace','search','audience_network');
CREATE TYPE public.meta_cta AS ENUM (
  'LEARN_MORE','SHOP_NOW','SIGN_UP','SUBSCRIBE','CONTACT_US','BOOK_TRAVEL','DOWNLOAD','GET_OFFER','APPLY_NOW','SEND_MESSAGE','WATCH_MORE'
);

-- Per-client Meta Ads account link
CREATE TABLE public.meta_ads_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE,
  ad_account_id text,
  business_name text,
  page_id text,
  instagram_actor_id text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meta_ads_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel" ON public.meta_ads_accounts FOR SELECT TO authenticated USING (owns_client(client_id));
CREATE POLICY "ins" ON public.meta_ads_accounts FOR INSERT TO authenticated WITH CHECK (owns_client(client_id));
CREATE POLICY "upd" ON public.meta_ads_accounts FOR UPDATE TO authenticated USING (owns_client(client_id)) WITH CHECK (owns_client(client_id));
CREATE POLICY "del" ON public.meta_ads_accounts FOR DELETE TO authenticated USING (owns_client(client_id));
CREATE TRIGGER trg_meta_ads_accounts_updated BEFORE UPDATE ON public.meta_ads_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Campaigns
CREATE TABLE public.meta_ads_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  fb_campaign_id text,
  name text NOT NULL DEFAULT 'Nueva campaña',
  objective public.meta_campaign_objective NOT NULL DEFAULT 'OUTCOME_TRAFFIC',
  status public.meta_status NOT NULL DEFAULT 'DRAFT',
  daily_budget numeric,
  lifetime_budget numeric,
  currency text DEFAULT 'USD',
  start_time date,
  stop_time date,
  notes text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meta_ads_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel" ON public.meta_ads_campaigns FOR SELECT TO authenticated USING (owns_client(client_id));
CREATE POLICY "ins" ON public.meta_ads_campaigns FOR INSERT TO authenticated WITH CHECK (owns_client(client_id));
CREATE POLICY "upd" ON public.meta_ads_campaigns FOR UPDATE TO authenticated USING (owns_client(client_id)) WITH CHECK (owns_client(client_id));
CREATE POLICY "del" ON public.meta_ads_campaigns FOR DELETE TO authenticated USING (owns_client(client_id));
CREATE TRIGGER trg_meta_ads_campaigns_updated BEFORE UPDATE ON public.meta_ads_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX ON public.meta_ads_campaigns(client_id);

-- Ad sets
CREATE TABLE public.meta_ads_adsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.meta_ads_campaigns(id) ON DELETE CASCADE,
  fb_adset_id text,
  name text NOT NULL DEFAULT 'Nuevo conjunto',
  status public.meta_status NOT NULL DEFAULT 'DRAFT',
  daily_budget numeric,
  lifetime_budget numeric,
  optimization_goal text,
  billing_event text,
  audience_summary text,
  age_min integer,
  age_max integer,
  genders text,
  countries text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meta_ads_adsets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel" ON public.meta_ads_adsets FOR SELECT TO authenticated USING (owns_client(client_id));
CREATE POLICY "ins" ON public.meta_ads_adsets FOR INSERT TO authenticated WITH CHECK (owns_client(client_id));
CREATE POLICY "upd" ON public.meta_ads_adsets FOR UPDATE TO authenticated USING (owns_client(client_id)) WITH CHECK (owns_client(client_id));
CREATE POLICY "del" ON public.meta_ads_adsets FOR DELETE TO authenticated USING (owns_client(client_id));
CREATE TRIGGER trg_meta_ads_adsets_updated BEFORE UPDATE ON public.meta_ads_adsets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX ON public.meta_ads_adsets(campaign_id);

-- Ads / creatives
CREATE TABLE public.meta_ads_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  adset_id uuid NOT NULL REFERENCES public.meta_ads_adsets(id) ON DELETE CASCADE,
  fb_ad_id text,
  name text NOT NULL DEFAULT 'Nuevo anuncio',
  status public.meta_status NOT NULL DEFAULT 'DRAFT',
  format text NOT NULL DEFAULT 'image',
  image_url text,
  video_url text,
  carousel_urls text[] NOT NULL DEFAULT '{}',
  primary_text text,
  headline text,
  description text,
  cta public.meta_cta DEFAULT 'LEARN_MORE',
  link_url text,
  placement public.meta_placement NOT NULL DEFAULT 'feed',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meta_ads_ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel" ON public.meta_ads_ads FOR SELECT TO authenticated USING (owns_client(client_id));
CREATE POLICY "ins" ON public.meta_ads_ads FOR INSERT TO authenticated WITH CHECK (owns_client(client_id));
CREATE POLICY "upd" ON public.meta_ads_ads FOR UPDATE TO authenticated USING (owns_client(client_id)) WITH CHECK (owns_client(client_id));
CREATE POLICY "del" ON public.meta_ads_ads FOR DELETE TO authenticated USING (owns_client(client_id));
CREATE TRIGGER trg_meta_ads_ads_updated BEFORE UPDATE ON public.meta_ads_ads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX ON public.meta_ads_ads(adset_id);

-- Insights / metrics (per campaign per period)
CREATE TABLE public.meta_ads_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.meta_ads_campaigns(id) ON DELETE CASCADE,
  date_start date,
  date_stop date,
  impressions bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  ctr numeric,
  spend numeric NOT NULL DEFAULT 0,
  cpc numeric,
  cpm numeric,
  conversions bigint NOT NULL DEFAULT 0,
  purchase_value numeric,
  roas numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.meta_ads_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel" ON public.meta_ads_insights FOR SELECT TO authenticated USING (owns_client(client_id));
CREATE POLICY "ins" ON public.meta_ads_insights FOR INSERT TO authenticated WITH CHECK (owns_client(client_id));
CREATE POLICY "upd" ON public.meta_ads_insights FOR UPDATE TO authenticated USING (owns_client(client_id)) WITH CHECK (owns_client(client_id));
CREATE POLICY "del" ON public.meta_ads_insights FOR DELETE TO authenticated USING (owns_client(client_id));
CREATE TRIGGER trg_meta_ads_insights_updated BEFORE UPDATE ON public.meta_ads_insights
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX ON public.meta_ads_insights(campaign_id);