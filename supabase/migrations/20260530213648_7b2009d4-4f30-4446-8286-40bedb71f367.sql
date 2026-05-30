-- 1) landing_events: remove broad authenticated SELECT (no per-tenant linkage available)
DROP POLICY IF EXISTS "Authenticated can read landing events" ON public.landing_events;

-- 2) Portfolio storage policies: enforce uploader ownership via path segment 2 (portfolio/<user_id>/...)
DROP POLICY IF EXISTS "Authenticated can upload portfolio media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update portfolio media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete portfolio media" ON storage.objects;

CREATE POLICY "Authenticated can upload own portfolio media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-media'
  AND (storage.foldername(name))[1] = 'portfolio'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);

CREATE POLICY "Authenticated can update own portfolio media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-media'
  AND (storage.foldername(name))[1] = 'portfolio'
  AND (storage.foldername(name))[2] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'client-media'
  AND (storage.foldername(name))[1] = 'portfolio'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);

CREATE POLICY "Authenticated can delete own portfolio media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-media'
  AND (storage.foldername(name))[1] = 'portfolio'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);

-- 3) Narrow public SELECT on client-media to the portfolio/ prefix to limit listing surface
DROP POLICY IF EXISTS "Public can read portfolio media" ON storage.objects;
CREATE POLICY "Public can read portfolio media"
ON storage.objects FOR SELECT TO anon, authenticated
USING (
  bucket_id = 'client-media'
  AND (storage.foldername(name))[1] = 'portfolio'
);