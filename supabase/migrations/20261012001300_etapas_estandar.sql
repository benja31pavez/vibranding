-- =====================================================================
-- Etapas del plan por cliente + estado de entrega de las tareas (vista Plan).
-- =====================================================================
-- Las etapas dependen del plan contratado (plantillas en
-- src/lib/delivery/planStages.ts). Claves posibles:
--   estrategia · branding · diseno · planificacion · contenido · ads ·
--   landing · chatbot · optimizacion · reporte · entrega
-- Hasta ahora una etapa era solo una fila de `deliverables` con ese título
-- ("Landing Page", "Optimización"…) y las tareas (`client_tasks`) no sabían a
-- qué etapa pertenecen ni si se entregaron al cliente. Esta migración agrega:
--   - deliverables.stage_key  (etapa que representa la fila; su due_date es la
--                              fecha de entrega de la etapa)
--   - client_tasks.stage_key  (etapa de la tarea)
--   - client_tasks.delivered_at (entregada al cliente → ✓✓ gris)
--   - client_tasks.approved_at  (aprobada por el cliente → ✓✓ azul)
-- Es aditiva y segura:
--   - columnas nuevas, nulas por defecto (nada existente deja de funcionar);
--   - CHECK que solo admite las claves conocidas o NULL;
--   - el relleno solo toca filas con `stage_key` NULL (se puede re-ejecutar);
--   - RLS sin cambios: las políticas existentes de ambas tablas (owns_client /
--     user_client_id) ya cubren las columnas nuevas.
-- La app tolera que aún no esté aplicada: sin las columnas deduce la etapa del
-- título, del marcador del plan del mes o de palabras de la tarea, y toma el
-- estado `in_review` como "entregada".
-- =====================================================================

-- 1. Columnas + CHECK -------------------------------------------------------
ALTER TABLE public.deliverables ADD COLUMN IF NOT EXISTS stage_key TEXT;
ALTER TABLE public.client_tasks ADD COLUMN IF NOT EXISTS stage_key TEXT;
ALTER TABLE public.client_tasks ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.client_tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

ALTER TABLE public.deliverables DROP CONSTRAINT IF EXISTS deliverables_stage_key_chk;
ALTER TABLE public.deliverables ADD CONSTRAINT deliverables_stage_key_chk CHECK (
  stage_key IS NULL
  OR stage_key IN ('estrategia', 'branding', 'diseno', 'planificacion', 'contenido', 'ads', 'landing', 'chatbot', 'optimizacion', 'reporte', 'entrega')
);

ALTER TABLE public.client_tasks DROP CONSTRAINT IF EXISTS client_tasks_stage_key_chk;
ALTER TABLE public.client_tasks ADD CONSTRAINT client_tasks_stage_key_chk CHECK (
  stage_key IS NULL
  OR stage_key IN ('estrategia', 'branding', 'diseno', 'planificacion', 'contenido', 'ads', 'landing', 'chatbot', 'optimizacion', 'reporte', 'entrega')
);

-- Aprobada implica entregada.
ALTER TABLE public.client_tasks DROP CONSTRAINT IF EXISTS client_tasks_approved_after_delivered_chk;
ALTER TABLE public.client_tasks ADD CONSTRAINT client_tasks_approved_after_delivered_chk CHECK (
  approved_at IS NULL OR delivered_at IS NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_client_tasks_client_stage
  ON public.client_tasks (client_id, stage_key);

-- 2. Etapas existentes: título (sin tildes, minúsculas) → clave -------------
UPDATE public.deliverables d
SET stage_key = m.stage_key
FROM (
  VALUES
    ('estrategia', 'estrategia'),
    ('branding', 'branding'),
    ('branding / diseno', 'branding'),
    ('diseno', 'diseno'),
    ('planificacion de contenido', 'planificacion'),
    ('planificacion', 'planificacion'),
    ('reporte', 'reporte'),
    ('reporte mensual', 'reporte'),
    ('entrega', 'entrega'),
    ('ads (meta / google)', 'ads'),
    ('landing / web', 'landing'),
    ('marca', 'branding'),
    ('identidad de marca', 'branding'),
    ('kit de marca', 'branding'),
    ('optimizacion', 'optimizacion'),
    ('optimizacion de perfil', 'optimizacion'),
    ('contenido', 'contenido'),
    ('plan de contenido', 'contenido'),
    ('ads', 'ads'),
    ('meta ads', 'ads'),
    ('publicidad', 'ads'),
    ('campanas', 'ads'),
    ('landing page', 'landing'),
    ('landing', 'landing'),
    ('pagina web', 'landing'),
    ('sitio web', 'landing'),
    ('web', 'landing'),
    ('chatbot', 'chatbot'),
    ('chatbot whatsapp', 'chatbot')
) AS m(title_norm, stage_key)
WHERE d.stage_key IS NULL
  AND lower(
        regexp_replace(
          translate(btrim(d.title), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'),
          '\s+', ' ', 'g'
        )
      ) = m.title_norm;

-- 3. Tareas del "Plan del mes": marcador [plan-mes:AAAA-MM:tipo-n] → clave ---
UPDATE public.client_tasks t
SET stage_key = m.stage_key
FROM (
  VALUES
    ('calendario', 'planificacion'),
    ('post', 'contenido'),
    ('reel', 'contenido'),
    ('google', 'optimizacion'),
    ('campanas', 'ads'),
    ('reporte', 'reporte'),
    ('reunion', 'estrategia'),
    ('inicio', 'branding'),
    ('kit-marca', 'branding'),
    ('landing', 'landing'),
    ('ajustes', 'landing'),
    ('google-business', 'optimizacion'),
    ('pruebas', 'landing'),
    ('entrega', 'entrega')
) AS m(kind, stage_key)
WHERE t.stage_key IS NULL
  AND regexp_replace(
        substring(t.description FROM '\[plan-mes:\d{4}-\d{2}:([a-z0-9-]+)\]'),
        '-\d+$', ''
      ) = m.kind;

-- Nota: la clave guardada es la "genérica" (p. ej. un post queda en 'contenido');
-- la app la ajusta al plan del cliente (en Mantención, 'contenido' se muestra en
-- Diseño). Las tareas sin marcador quedan en NULL: la app las sigue
-- clasificando por palabras del título hasta que alguien les asigne etapa.

-- 4. Tareas ya entregadas: el estado in_review ("en revisión del cliente") se
--    toma como entregada. Se conserva el estado; solo se fija la fecha.
UPDATE public.client_tasks
SET delivered_at = updated_at
WHERE status = 'in_review' AND delivered_at IS NULL;
