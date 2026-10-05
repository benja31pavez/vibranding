-- =====================================================================
-- VIBRANDING · Notas del cliente al aprobar / pedir cambios en posts
-- (portal del cliente v2, PR feat/portal-v2)
-- =====================================================================
-- Hasta ahora la nota de "Pedir cambios" de un post solo se podía guardar en
-- deliverable_comments, que exige un entregable vinculado. Estas columnas la
-- guardan en el propio post, para que el equipo la vea siempre:
--
--   approval_note       texto del cliente (máx. 2000 caracteres)
--   approval_note_at    cuándo la dejó
--   approval_note_read  false = el equipo aún no la lee (análogo a
--                       deliverable_comments.read_by_agency)
--
-- Escritura: solo la server fn decidePortalItem (service role, UPDATE
-- condicional por id + client_id + approval_status='pendiente'). El usuario
-- del portal sigue sin policy sobre instagram_posts. El equipo lee y marca
-- como leída con las policies de agencia que ya existen.
--
-- No se cambia la policy "client user reads deliverable_comments": hoy no
-- existe ningún kind interno (solo comment / approval / change_request) y el
-- portal además filtra por kind y author_role en el servidor.
--
-- Idempotente: se puede ejecutar más de una vez. El código tolera que estas
-- columnas aún no existan (cae al comportamiento anterior).
--
-- Para revertir:
--   DROP INDEX IF EXISTS public.instagram_posts_note_unread_idx;
--   ALTER TABLE public.instagram_posts DROP CONSTRAINT IF EXISTS instagram_posts_approval_note_len_chk;
--   ALTER TABLE public.instagram_posts
--     DROP COLUMN IF EXISTS approval_note_read,
--     DROP COLUMN IF EXISTS approval_note_at,
--     DROP COLUMN IF EXISTS approval_note;
-- =====================================================================

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.instagram_posts
  ADD COLUMN IF NOT EXISTS approval_note text,
  ADD COLUMN IF NOT EXISTS approval_note_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_note_read boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'instagram_posts_approval_note_len_chk'
      AND conrelid = 'public.instagram_posts'::regclass
  ) THEN
    ALTER TABLE public.instagram_posts ADD CONSTRAINT instagram_posts_approval_note_len_chk
      CHECK (approval_note IS NULL OR char_length(approval_note) <= 2000);
  END IF;
END $$;

COMMENT ON COLUMN public.instagram_posts.approval_note IS
  'Nota del cliente al aprobar o pedir cambios desde el portal (máx. 2000).';
COMMENT ON COLUMN public.instagram_posts.approval_note_at IS
  'Momento en que el cliente dejó approval_note.';
COMMENT ON COLUMN public.instagram_posts.approval_note_read IS
  'false = el equipo aún no lee la nota del cliente (como read_by_agency).';

CREATE INDEX IF NOT EXISTS instagram_posts_note_unread_idx
  ON public.instagram_posts (client_id)
  WHERE approval_note_read = false;
