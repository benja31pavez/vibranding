-- =====================================================================
-- Fase 0 · 5/5 — Bucket client-media: sin listado público
-- =====================================================================
-- Problema (H7): la policy "client-media public read" (SELECT sobre
-- storage.objects para el rol public = anon + authenticated, todo el bucket)
-- permitía LISTAR los archivos de todos los clientes con la API de Storage
-- (rutas {uid_agencia}/{client_id}/…), no solo descargar los que uno ya
-- conoce.
--
-- Por qué se puede quitar sin romper nada:
--   - El bucket es público: las URL /storage/v1/object/public/client-media/…
--     (getPublicUrl, usadas en posts, landings, multilinks, logos, avatar,
--     portafolio) se sirven SIN pasar por RLS. Siguen funcionando.
--   - Nadie lista el bucket desde el navegador: el único .list() es
--     src/lib/clients/logo.server.ts, con service_role (no pasa por RLS).
--   - Las subidas desde el navegador escriben en {auth.uid()}/… o en
--     portfolio/{auth.uid()}/…; la del avatar usa upsert, que necesita SELECT
--     sobre el objeto propio. Por eso se agrega una policy SELECT acotada a
--     la carpeta del propio usuario.
--   - "Public can read portfolio media" (portfolio/…, público por diseño) se
--     mantiene.
-- Re-ejecutable.
-- =====================================================================

DROP POLICY IF EXISTS "client-media public read" ON storage.objects;

DROP POLICY IF EXISTS "client-media auth read own folder" ON storage.objects;
CREATE POLICY "client-media auth read own folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-media'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
