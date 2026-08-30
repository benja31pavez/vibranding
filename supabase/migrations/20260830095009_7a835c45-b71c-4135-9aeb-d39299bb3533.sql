ALTER TABLE public.meta_accounts
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS token_valid boolean,
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_ingest_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_ingest_rows integer,
  ADD COLUMN IF NOT EXISTS last_ingest_reason text;