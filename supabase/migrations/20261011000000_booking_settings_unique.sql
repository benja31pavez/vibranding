-- =========================================================
-- Agenda única por usuario (booking_settings sin cliente)
-- =========================================================
-- UNIQUE (owner_user_id, client_id) no impide duplicados cuando client_id es
-- NULL (en Postgres NULL <> NULL). ensureBookingSettings se llamaba dos veces al
-- montar la página (UpcomingBookings + BookingsPanel) y, una vez que existía
-- más de una fila, maybeSingle() fallaba y se creaba otra agenda en cada carga.
--
-- Esta migración es idempotente:
--   1. Copia la configuración más reciente (la que el usuario editó) a la fila
--      que se conserva (la más antigua por owner_user_id).
--   2. Reasigna las reservas de las agendas duplicadas a la conservada.
--   3. Guarda los slugs de las duplicadas como alias para que los links ya
--      compartidos sigan funcionando.
--   4. Borra las duplicadas.
--   5. Crea el índice único parcial (owner_user_id) WHERE client_id IS NULL.
--   6. get_booking_settings_by_slug también resuelve alias.

-- Alias de slugs antiguos (solo accesible vía funciones SECURITY DEFINER).
CREATE TABLE IF NOT EXISTS public.booking_slug_aliases (
  slug text PRIMARY KEY,
  settings_id uuid NOT NULL REFERENCES public.booking_settings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.booking_slug_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_slug_aliases FROM anon, authenticated;
GRANT ALL ON public.booking_slug_aliases TO service_role;

-- 1. Configuración más reciente -> fila conservada.
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (PARTITION BY owner_user_id ORDER BY created_at, id) AS keep_id,
    first_value(id) OVER (PARTITION BY owner_user_id ORDER BY updated_at DESC, id) AS latest_id
  FROM public.booking_settings
  WHERE client_id IS NULL
),
pairs AS (
  SELECT DISTINCT keep_id, latest_id FROM ranked WHERE keep_id <> latest_id
)
UPDATE public.booking_settings k
SET display_name = l.display_name,
    hours = l.hours,
    slot_minutes = l.slot_minutes,
    timezone = l.timezone,
    notification_email = COALESCE(l.notification_email, k.notification_email),
    enabled = l.enabled,
    intro = l.intro
FROM pairs p
JOIN public.booking_settings l ON l.id = p.latest_id
WHERE k.id = p.keep_id;

-- 2. Reservas de las duplicadas -> fila conservada.
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (PARTITION BY owner_user_id ORDER BY created_at, id) AS keep_id
  FROM public.booking_settings
  WHERE client_id IS NULL
)
UPDATE public.bookings b
SET settings_id = r.keep_id
FROM ranked r
WHERE b.settings_id = r.id
  AND r.id <> r.keep_id;

-- 3. Slugs de las duplicadas como alias de la conservada.
WITH ranked AS (
  SELECT
    id,
    slug,
    first_value(id) OVER (PARTITION BY owner_user_id ORDER BY created_at, id) AS keep_id
  FROM public.booking_settings
  WHERE client_id IS NULL
)
INSERT INTO public.booking_slug_aliases (slug, settings_id)
SELECT r.slug, r.keep_id
FROM ranked r
WHERE r.id <> r.keep_id
ON CONFLICT (slug) DO NOTHING;

-- 4. Borrar duplicadas.
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (PARTITION BY owner_user_id ORDER BY created_at, id) AS keep_id
  FROM public.booking_settings
  WHERE client_id IS NULL
)
DELETE FROM public.booking_settings s
USING ranked r
WHERE s.id = r.id
  AND r.id <> r.keep_id;

-- 5. Una sola agenda general (sin cliente) por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS booking_settings_owner_general_uniq
  ON public.booking_settings (owner_user_id)
  WHERE client_id IS NULL;

-- 6. Resolver también slugs antiguos (alias).
CREATE OR REPLACE FUNCTION public.get_booking_settings_by_slug(_slug text)
RETURNS TABLE(id uuid, owner_user_id uuid, client_id uuid, display_name text, hours jsonb, slot_minutes int, timezone text, enabled boolean, intro text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.owner_user_id, s.client_id, s.display_name, s.hours, s.slot_minutes, s.timezone, s.enabled, s.intro
  FROM public.booking_settings s
  WHERE s.enabled = true
    AND (
      s.slug = _slug
      OR s.id = (SELECT a.settings_id FROM public.booking_slug_aliases a WHERE a.slug = _slug)
    )
  ORDER BY (s.slug = _slug) DESC
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_booking_settings_by_slug(text) TO anon, authenticated;
