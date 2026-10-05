-- =====================================================================
-- Plantillas del plan: tareas y objetivos estándar por plan y etapa.
-- =====================================================================
-- El catálogo vive en src/lib/delivery/planChecklists.ts. Al abrir el Plan de
-- un cliente (o al guardar su plan) la app crea las tareas y objetivos
-- estándar que falten. Esta migración agrega lo necesario para que eso sea
-- idempotente y para que lo que el equipo borró no vuelva a aparecer:
--
--   1. objectives.template_key  ("objetivo:<plan>:<clave>"), único por cliente.
--   2. Índice único parcial en client_tasks por el marcador
--      [plantilla:<etapa>:<clave>] de la descripción (evita duplicados si dos
--      pestañas siembran a la vez). Antes, si ya hubiera duplicados (sembrados
--      sin esta migración), a los más nuevos se les cambia el marcador a
--      [plantilla-dup:…]: no se borra ninguna fila.
--   3. plan_template_seeds: registro de cada clave de plantilla ya creada o
--      vista por cliente. Si alguien borra una tarea u objetivo estándar, no
--      se vuelve a crear.
--
-- Aditiva y segura: columnas nulas, tabla nueva, IF NOT EXISTS y DROP POLICY
-- IF EXISTS (se puede re-ejecutar). La app tolera que no esté aplicada:
-- reconoce los objetivos por título y usa una regla de respaldo por etapa.
-- RLS de la tabla nueva: igual que client_tasks (owns_client).
-- =====================================================================

-- 1. objectives.template_key -------------------------------------------------
ALTER TABLE public.objectives ADD COLUMN IF NOT EXISTS template_key TEXT;

ALTER TABLE public.objectives DROP CONSTRAINT IF EXISTS objectives_template_key_chk;
ALTER TABLE public.objectives ADD CONSTRAINT objectives_template_key_chk CHECK (
  template_key IS NULL OR template_key ~ '^objetivo:[a-z-]+:[a-z0-9-]+$'
) NOT VALID;
ALTER TABLE public.objectives VALIDATE CONSTRAINT objectives_template_key_chk;

CREATE UNIQUE INDEX IF NOT EXISTS uq_objectives_client_template
  ON public.objectives (client_id, template_key)
  WHERE template_key IS NOT NULL;

-- 2. Tareas estándar: un marcador por cliente --------------------------------
-- 2a. Duplicados previos (si los hay): se conserva el más antiguo con su marcador.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY client_id,
                        substring(description FROM '\[plantilla:[a-z]+:[a-z0-9-]+\]')
           ORDER BY created_at, id
         ) AS rn
  FROM public.client_tasks
  WHERE description ~ '\[plantilla:[a-z]+:[a-z0-9-]+\]'
)
UPDATE public.client_tasks t
SET description = replace(t.description, '[plantilla:', '[plantilla-dup:')
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

-- 2b. Índice único parcial por (cliente, marcador).
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_tasks_client_plantilla
  ON public.client_tasks (
    client_id,
    (substring(description FROM '\[plantilla:[a-z]+:[a-z0-9-]+\]'))
  )
  WHERE description ~ '\[plantilla:[a-z]+:[a-z0-9-]+\]';

-- 3. Registro de plantillas sembradas ----------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_template_seeds (
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  -- "tarea:<etapa>:<clave>" u "objetivo:<plan>:<clave>"
  item_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, item_key),
  CONSTRAINT plan_template_seeds_item_key_chk
    CHECK (item_key ~ '^(tarea|objetivo):[a-z-]+:[a-z0-9-]+$')
);

COMMENT ON TABLE public.plan_template_seeds IS
  'Claves de tareas/objetivos estándar del plan ya creadas o vistas por cliente. Lo que se borra no se vuelve a crear. Catálogo: src/lib/delivery/planChecklists.ts.';

REVOKE ALL ON public.plan_template_seeds FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.plan_template_seeds TO authenticated;
GRANT ALL ON public.plan_template_seeds TO service_role;
ALTER TABLE public.plan_template_seeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_template_seeds select" ON public.plan_template_seeds;
CREATE POLICY "plan_template_seeds select" ON public.plan_template_seeds
  FOR SELECT TO authenticated USING (public.owns_client(client_id));

DROP POLICY IF EXISTS "plan_template_seeds insert" ON public.plan_template_seeds;
CREATE POLICY "plan_template_seeds insert" ON public.plan_template_seeds
  FOR INSERT TO authenticated WITH CHECK (public.owns_client(client_id));

DROP POLICY IF EXISTS "plan_template_seeds delete" ON public.plan_template_seeds;
CREATE POLICY "plan_template_seeds delete" ON public.plan_template_seeds
  FOR DELETE TO authenticated USING (public.owns_client(client_id));

-- 4. Recargar el esquema de PostgREST ----------------------------------------
NOTIFY pgrst, 'reload schema';
