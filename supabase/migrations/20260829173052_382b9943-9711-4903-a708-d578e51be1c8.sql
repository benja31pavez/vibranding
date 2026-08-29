ALTER TABLE public.meta_ads_campaigns
  ADD COLUMN IF NOT EXISTS meta_account_id uuid REFERENCES public.meta_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.meta_ads_adsets
  ADD COLUMN IF NOT EXISTS meta_account_id uuid REFERENCES public.meta_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.meta_ads_ads
  ADD COLUMN IF NOT EXISTS meta_account_id uuid REFERENCES public.meta_accounts(id) ON DELETE SET NULL;

UPDATE public.meta_ads_campaigns t
SET meta_account_id = a.id
FROM public.meta_accounts a
WHERE a.client_id = t.client_id AND t.meta_account_id IS NULL;

UPDATE public.meta_ads_adsets t
SET meta_account_id = a.id
FROM public.meta_accounts a
WHERE a.client_id = t.client_id AND t.meta_account_id IS NULL;

UPDATE public.meta_ads_ads t
SET meta_account_id = a.id
FROM public.meta_accounts a
WHERE a.client_id = t.client_id AND t.meta_account_id IS NULL;

CREATE INDEX IF NOT EXISTS meta_ads_campaigns_meta_account_idx ON public.meta_ads_campaigns(meta_account_id);
CREATE INDEX IF NOT EXISTS meta_ads_adsets_meta_account_idx ON public.meta_ads_adsets(meta_account_id);
CREATE INDEX IF NOT EXISTS meta_ads_ads_meta_account_idx ON public.meta_ads_ads(meta_account_id);

REVOKE ALL ON public.meta_accounts FROM anon;
REVOKE ALL ON public.ad_insights_daily FROM anon;
REVOKE ALL ON public.post_insights_daily FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_accounts TO authenticated;
GRANT ALL ON public.meta_accounts TO service_role;
GRANT SELECT ON public.ad_insights_daily TO authenticated;
GRANT ALL ON public.ad_insights_daily TO service_role;
GRANT SELECT ON public.post_insights_daily TO authenticated;
GRANT ALL ON public.post_insights_daily TO service_role;