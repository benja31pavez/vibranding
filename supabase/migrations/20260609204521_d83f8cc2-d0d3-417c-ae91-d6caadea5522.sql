
CREATE TABLE public.booking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT 'Agenda',
  hours jsonb NOT NULL DEFAULT '[{"day":0,"enabled":true,"open":"09:00","close":"18:00"},{"day":1,"enabled":true,"open":"09:00","close":"18:00"},{"day":2,"enabled":true,"open":"09:00","close":"18:00"},{"day":3,"enabled":true,"open":"09:00","close":"18:00"},{"day":4,"enabled":true,"open":"09:00","close":"18:00"},{"day":5,"enabled":false,"open":"10:00","close":"14:00"},{"day":6,"enabled":false,"open":"10:00","close":"14:00"}]'::jsonb,
  slot_minutes int NOT NULL DEFAULT 30,
  timezone text NOT NULL DEFAULT 'America/Santiago',
  notification_email text,
  enabled boolean NOT NULL DEFAULT true,
  intro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_settings TO authenticated;
GRANT ALL ON public.booking_settings TO service_role;
ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manage booking_settings" ON public.booking_settings FOR ALL TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE TRIGGER t_booking_settings_u BEFORE UPDATE ON public.booking_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  settings_id uuid REFERENCES public.booking_settings(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  duration_minutes int NOT NULL DEFAULT 30,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  notes text,
  status text NOT NULL DEFAULT 'confirmed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manage bookings" ON public.bookings FOR ALL TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE TRIGGER t_bookings_u BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE UNIQUE INDEX bookings_owner_slot_uniq ON public.bookings (owner_user_id, scheduled_at)
  WHERE client_id IS NULL AND status = 'confirmed';
CREATE UNIQUE INDEX bookings_client_slot_uniq ON public.bookings (client_id, scheduled_at)
  WHERE client_id IS NOT NULL AND status = 'confirmed';
CREATE INDEX bookings_owner_time_idx ON public.bookings (owner_user_id, scheduled_at);

CREATE OR REPLACE FUNCTION public.get_booking_settings_by_slug(_slug text)
RETURNS TABLE(id uuid, owner_user_id uuid, client_id uuid, display_name text, hours jsonb, slot_minutes int, timezone text, enabled boolean, intro text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, owner_user_id, client_id, display_name, hours, slot_minutes, timezone, enabled, intro
  FROM public.booking_settings WHERE slug = _slug AND enabled = true;
$$;

CREATE OR REPLACE FUNCTION public.list_taken_slots(_settings_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(scheduled_at timestamptz, duration_minutes int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.scheduled_at, b.duration_minutes
  FROM public.bookings b
  JOIN public.booking_settings s ON s.id = _settings_id
  WHERE b.status = 'confirmed'
    AND b.owner_user_id = s.owner_user_id
    AND ((s.client_id IS NULL AND b.client_id IS NULL) OR b.client_id = s.client_id)
    AND b.scheduled_at >= _from
    AND b.scheduled_at < _to;
$$;
GRANT EXECUTE ON FUNCTION public.get_booking_settings_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_taken_slots(uuid, timestamptz, timestamptz) TO anon, authenticated;
