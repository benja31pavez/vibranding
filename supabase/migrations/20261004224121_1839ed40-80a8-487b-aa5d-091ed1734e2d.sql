-- =========================================================
-- Reservas: agenda única, alias de slugs y reservas atómicas
-- =========================================================
-- UNIQUE (owner_user_id, client_id) no impide duplicados cuando client_id es
-- NULL (en Postgres NULL <> NULL). ensureBookingSettings se llamaba dos veces al
-- montar la página (UpcomingBookings + BookingsPanel) y, una vez que existía
-- más de una fila, maybeSingle() fallaba y se creaba otra agenda en cada carga.
--
-- Idempotente. Pasos:
--   0. Bloquea booking_settings y bookings mientras se deduplica.
--   1. Copia la configuración más reciente (la que el usuario editó) a la fila
--      que se conserva (la más antigua por owner_user_id, sin cliente).
--   2. Reasigna las reservas de las duplicadas a la conservada.
--   3. Borra las duplicadas y guarda sus slugs como alias (links ya
--      compartidos siguen funcionando).
--   4. Índice único parcial (owner_user_id) WHERE client_id IS NULL.
--   5. Triggers: un slug vigente no puede ser alias de otra agenda y viceversa.
--   6. get_booking_settings_by_slug: resuelve alias y queda solo para service_role.
--   7. create_booking_atomic: límites + solape + insert bajo advisory lock.
--   8. booking_email_log + claim_booking_email_slot: máx. N confirmaciones
--      por email destinatario en 24 h.
--
-- NOTA: Lovable / Supabase ejecutan cada migración dentro de una transacción,
-- por eso no hay BEGIN/COMMIT explícitos. LOCK TABLE exige esa transacción
-- (fuera de ella falla con "LOCK TABLE can only be used in transaction blocks").

-- 0. Bloqueo durante la deduplicación (permite lecturas, bloquea escrituras).
LOCK TABLE public.booking_settings, public.bookings IN SHARE ROW EXCLUSIVE MODE;

-- Alias de slugs antiguos (solo accesible vía funciones SECURITY DEFINER).
CREATE TABLE IF NOT EXISTS public.booking_slug_aliases (
  slug text PRIMARY KEY,
  settings_id uuid NOT NULL REFERENCES public.booking_settings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_slug_aliases_settings_idx
  ON public.booking_slug_aliases (settings_id);
ALTER TABLE public.booking_slug_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_slug_aliases FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.booking_slug_aliases TO service_role;

-- Duplicadas a eliminar (id, slug, fila conservada).
DROP TABLE IF EXISTS pg_temp._booking_settings_dupes;
CREATE TEMP TABLE _booking_settings_dupes AS
SELECT id, slug, keep_id
FROM (
  SELECT
    id,
    slug,
    first_value(id) OVER (PARTITION BY owner_user_id ORDER BY created_at, id) AS keep_id
  FROM public.booking_settings
  WHERE client_id IS NULL
) ranked
WHERE id <> keep_id;

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
UPDATE public.bookings b
SET settings_id = d.keep_id
FROM _booking_settings_dupes d
WHERE b.settings_id = d.id;

-- 3. Borrar duplicadas y conservar sus slugs como alias.
DELETE FROM public.booking_settings s
USING _booking_settings_dupes d
WHERE s.id = d.id;

INSERT INTO public.booking_slug_aliases (slug, settings_id)
SELECT d.slug, d.keep_id
FROM _booking_settings_dupes d
ON CONFLICT (slug) DO NOTHING;

DROP TABLE IF EXISTS pg_temp._booking_settings_dupes;

-- 4. Una sola agenda general (sin cliente) por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS booking_settings_owner_general_uniq
  ON public.booking_settings (owner_user_id)
  WHERE client_id IS NULL;

-- 5. Slugs vigentes y alias no pueden chocar entre agendas distintas.
CREATE OR REPLACE FUNCTION public.booking_settings_slug_not_alias()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.booking_slug_aliases a
    WHERE a.slug = NEW.slug AND a.settings_id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'El link de agenda "%" ya está en uso', NEW.slug USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_settings_slug_not_alias() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_booking_settings_slug_not_alias ON public.booking_settings;
CREATE TRIGGER t_booking_settings_slug_not_alias
  BEFORE INSERT OR UPDATE OF slug ON public.booking_settings
  FOR EACH ROW EXECUTE FUNCTION public.booking_settings_slug_not_alias();

CREATE OR REPLACE FUNCTION public.booking_slug_alias_not_live()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.booking_settings s
    WHERE s.slug = NEW.slug AND s.id <> NEW.settings_id
  ) THEN
    RAISE EXCEPTION 'El alias "%" coincide con el link de otra agenda', NEW.slug USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_slug_alias_not_live() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_booking_slug_alias_not_live ON public.booking_slug_aliases;
CREATE TRIGGER t_booking_slug_alias_not_live
  BEFORE INSERT OR UPDATE ON public.booking_slug_aliases
  FOR EACH ROW EXECUTE FUNCTION public.booking_slug_alias_not_live();

-- 6. Lectura pública de la agenda por slug (o alias). Solo el servidor
--    (service_role) la llama; no devuelve owner_user_id ni client_id.
DROP FUNCTION IF EXISTS public.get_booking_settings_by_slug(text);
CREATE FUNCTION public.get_booking_settings_by_slug(_slug text)
RETURNS TABLE(id uuid, display_name text, hours jsonb, slot_minutes int, timezone text, enabled boolean, intro text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.display_name, s.hours, s.slot_minutes, s.timezone, s.enabled, s.intro
  FROM public.booking_settings s
  WHERE s.enabled = true
    AND (
      s.slug = _slug
      OR s.id = (SELECT a.settings_id FROM public.booking_slug_aliases a WHERE a.slug = _slug)
    )
  ORDER BY (s.slug = _slug) DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_booking_settings_by_slug(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_booking_settings_by_slug(text) TO service_role;

-- 7. Crear reserva de forma atómica: un advisory lock por agenda serializa
--    las reservas concurrentes, así los límites y el solape no tienen carreras.
--    Errores (mensaje): BOOKING_AGENDA_NOT_FOUND, BOOKING_RATE_LIMITED,
--    BOOKING_SLOT_TAKEN.
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
  _settings_id uuid,
  _scheduled_at timestamptz,
  _name text,
  _email text,
  _phone text,
  _notes text,
  _max_per_email_day int,
  _max_per_agenda_hour int
)
RETURNS TABLE(booking_id uuid, booking_scheduled_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  _s public.booking_settings%ROWTYPE;
  _end timestamptz;
  _new_id uuid;
BEGIN
  -- Defensa en la BD: límites válidos y datos mínimos (el servidor ya valida).
  IF _max_per_email_day IS NULL OR _max_per_email_day < 1
     OR _max_per_agenda_hour IS NULL OR _max_per_agenda_hour < 1 THEN
    RAISE EXCEPTION 'BOOKING_BAD_LIMITS';
  END IF;
  IF _scheduled_at IS NULL OR _scheduled_at <= now() THEN
    RAISE EXCEPTION 'BOOKING_IN_PAST';
  END IF;
  IF coalesce(btrim(_name), '') = '' OR coalesce(btrim(_email), '') = '' THEN
    RAISE EXCEPTION 'BOOKING_MISSING_FIELDS';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_settings_id::text));

  SELECT * INTO _s FROM public.booking_settings bs
  WHERE bs.id = _settings_id AND bs.enabled = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_AGENDA_NOT_FOUND';
  END IF;

  IF (
    SELECT count(*) FROM public.bookings b
    WHERE b.settings_id = _settings_id
      AND lower(b.customer_email) = lower(_email)
      AND b.created_at >= now() - interval '24 hours'
  ) >= _max_per_email_day THEN
    RAISE EXCEPTION 'BOOKING_RATE_LIMITED';
  END IF;

  IF (
    SELECT count(*) FROM public.bookings b
    WHERE b.settings_id = _settings_id
      AND b.created_at >= now() - interval '1 hour'
  ) >= _max_per_agenda_hour THEN
    RAISE EXCEPTION 'BOOKING_RATE_LIMITED';
  END IF;

  _end := _scheduled_at + make_interval(mins => _s.slot_minutes);
  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.status = 'confirmed'
      AND b.owner_user_id = _s.owner_user_id
      AND ((_s.client_id IS NULL AND b.client_id IS NULL) OR b.client_id = _s.client_id)
      AND b.scheduled_at < _end
      AND b.scheduled_at + make_interval(mins => b.duration_minutes) > _scheduled_at
  ) THEN
    RAISE EXCEPTION 'BOOKING_SLOT_TAKEN';
  END IF;

  INSERT INTO public.bookings (
    owner_user_id, client_id, settings_id, scheduled_at, duration_minutes,
    customer_name, customer_email, customer_phone, notes, status
  ) VALUES (
    _s.owner_user_id, _s.client_id, _s.id, _scheduled_at, _s.slot_minutes,
    _name, _email, NULLIF(_phone, ''), NULLIF(_notes, ''), 'confirmed'
  )
  RETURNING id INTO _new_id;

  RETURN QUERY SELECT _new_id, _scheduled_at;
END;
$$;
REVOKE ALL ON FUNCTION public.create_booking_atomic(uuid, timestamptz, text, text, text, text, int, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_atomic(uuid, timestamptz, text, text, text, text, int, int)
  TO service_role;

-- 8. Límite global de confirmaciones por email destinatario (hash, sin PII).
CREATE TABLE IF NOT EXISTS public.booking_email_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_email_log_hash_time_idx
  ON public.booking_email_log (email_hash, created_at);
CREATE INDEX IF NOT EXISTS booking_email_log_time_idx
  ON public.booking_email_log (created_at);
ALTER TABLE public.booking_email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_email_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.booking_email_log TO service_role;

-- Reserva un cupo de envío: true si se puede enviar (y lo registra).
CREATE OR REPLACE FUNCTION public.claim_booking_email_slot(_email_hash text, _max_per_day int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF _max_per_day IS NULL OR _max_per_day < 1 OR coalesce(_email_hash, '') = '' THEN
    RAISE EXCEPTION 'BOOKING_BAD_LIMITS';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('booking_email:' || _email_hash));
  DELETE FROM public.booking_email_log l WHERE l.created_at < now() - interval '7 days';
  IF (
    SELECT count(*) FROM public.booking_email_log l
    WHERE l.email_hash = _email_hash
      AND l.created_at >= now() - interval '24 hours'
  ) >= _max_per_day THEN
    RETURN false;
  END IF;
  INSERT INTO public.booking_email_log (email_hash) VALUES (_email_hash);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_booking_email_slot(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_booking_email_slot(text, int) TO service_role;