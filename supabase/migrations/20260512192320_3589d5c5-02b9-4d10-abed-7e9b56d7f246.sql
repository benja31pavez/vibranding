CREATE TABLE public.pricing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  currency text NOT NULL DEFAULT 'USD',
  pack_price numeric NOT NULL DEFAULT 0,
  pack_description text,
  photo_price numeric NOT NULL DEFAULT 0,
  carousel_price numeric NOT NULL DEFAULT 0,
  reel_price numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own pricing select" ON public.pricing_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own pricing insert" ON public.pricing_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own pricing update" ON public.pricing_settings
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own pricing delete" ON public.pricing_settings
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER pricing_settings_touch
  BEFORE UPDATE ON public.pricing_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();