-- Allow a separate music-platform item kind so Spotify etc are not mixed with social networks.
ALTER TABLE public.multilink_items
  DROP CONSTRAINT IF EXISTS multilink_items_kind_chk;
ALTER TABLE public.multilink_items
  ADD CONSTRAINT multilink_items_kind_chk
  CHECK (kind IN ('link', 'whatsapp', 'video', 'social', 'platform'));
