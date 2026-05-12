
-- Enums
CREATE TYPE public.task_status AS ENUM ('pending','in_progress','done');
CREATE TYPE public.payment_status AS ENUM ('pending','paid','overdue','cancelled');
CREATE TYPE public.ig_post_type AS ENUM ('current','proposed');

-- Clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  instagram_handle TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Objectives
CREATE TABLE public.objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'pending',
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deliverables
CREATE TABLE public.deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'pending',
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instagram profile (one row per client, holds both current + proposed)
CREATE TABLE public.instagram_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  current_username TEXT,
  current_followers INT DEFAULT 0,
  current_following INT DEFAULT 0,
  current_posts_count INT DEFAULT 0,
  current_avatar_url TEXT,
  current_bio TEXT,
  current_link TEXT,
  proposed_username TEXT,
  proposed_avatar_url TEXT,
  proposed_bio TEXT,
  proposed_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Instagram posts (current OR proposed)
CREATE TABLE public.instagram_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type public.ig_post_type NOT NULL,
  position INT NOT NULL DEFAULT 0,
  image_url TEXT,
  caption TEXT,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status public.payment_status NOT NULL DEFAULT 'pending',
  due_date DATE,
  paid_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER t_clients_u BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_obj_u BEFORE UPDATE ON public.objectives FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_del_u BEFORE UPDATE ON public.deliverables FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_igp_u BEFORE UPDATE ON public.instagram_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_igpost_u BEFORE UPDATE ON public.instagram_posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_pay_u BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper: does the current user own this client?
CREATE OR REPLACE FUNCTION public.owns_client(_client_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.clients WHERE id = _client_id AND user_id = auth.uid());
$$;

-- RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- clients policies
CREATE POLICY "own clients select" ON public.clients FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own clients insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own clients update" ON public.clients FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own clients delete" ON public.clients FOR DELETE TO authenticated USING (user_id = auth.uid());

-- generic per-client policy generator via owns_client
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['objectives','deliverables','instagram_profiles','instagram_posts','payments']
  LOOP
    EXECUTE format('CREATE POLICY "sel" ON public.%I FOR SELECT TO authenticated USING (public.owns_client(client_id));', t);
    EXECUTE format('CREATE POLICY "ins" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));', t);
    EXECUTE format('CREATE POLICY "upd" ON public.%I FOR UPDATE TO authenticated USING (public.owns_client(client_id)) WITH CHECK (public.owns_client(client_id));', t);
    EXECUTE format('CREATE POLICY "del" ON public.%I FOR DELETE TO authenticated USING (public.owns_client(client_id));', t);
  END LOOP;
END $$;

-- Auto-create instagram_profiles row when client is created
CREATE OR REPLACE FUNCTION public.create_ig_profile_for_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.instagram_profiles (client_id) VALUES (NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER t_client_ig AFTER INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.create_ig_profile_for_client();
