CREATE UNIQUE INDEX IF NOT EXISTS meta_accounts_ad_account_id_uk
  ON public.meta_accounts (ad_account_id)
  WHERE ad_account_id IS NOT NULL;