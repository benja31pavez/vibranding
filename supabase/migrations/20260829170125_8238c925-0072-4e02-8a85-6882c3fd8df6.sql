ALTER TABLE public.meta_accounts
  ADD COLUMN IF NOT EXISTS auth_type text NOT NULL DEFAULT 'oauth';

ALTER TABLE public.meta_accounts
  DROP CONSTRAINT IF EXISTS meta_accounts_auth_type_check;

ALTER TABLE public.meta_accounts
  ADD CONSTRAINT meta_accounts_auth_type_check CHECK (auth_type IN ('oauth','system_user'));

CREATE INDEX IF NOT EXISTS meta_accounts_ad_account_id_idx
  ON public.meta_accounts (ad_account_id);