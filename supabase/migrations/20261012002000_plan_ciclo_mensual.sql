-- =====================================================================
-- Ciclo mensual del plan: tareas que se repiten cada mes.
-- =====================================================================
-- El catálogo vive en src/lib/delivery/planCycle.ts. Cada tarea del ciclo
-- lleva en la descripción el marcador [plantilla:<etapa>:<clave>:<AAAA-MM>] y
-- se registra en plan_template_seeds como 'ciclo:<clave>:<AAAA-MM>' (una vez
-- por cliente y mes; si alguien la borra, no vuelve).
--
--   1. plan_template_seeds.item_key acepta también 'ciclo:<clave>:<AAAA-MM>'
--      (antes solo 'tarea:…' y 'objetivo:…').
--   2. Índice único parcial en client_tasks por (cliente, clave + mes) del
--      marcador del ciclo (la etapa no cuenta: si cambia el plan, no se repite
--      la tarea del mes). Evita duplicados si la app y el cron siembran a la
--      vez. Antes, si ya hubiera duplicados, a los más nuevos se les cambia el
--      marcador a [plantilla-dup:…]: no se borra ninguna fila.
--
-- Requiere 20261012001800_plan_plantillas.sql. Aditiva y re-ejecutable. La app
-- tolera que no esté aplicada (crea las tareas del ciclo, pero sin registrar
-- su clave). El cron va aparte: 20261012002010_cron_plan_ciclo.sql.
-- =====================================================================

-- 1. Claves del ciclo en el registro ------------------------------------------
ALTER TABLE public.plan_template_seeds
  DROP CONSTRAINT IF EXISTS plan_template_seeds_item_key_chk;
ALTER TABLE public.plan_template_seeds
  ADD CONSTRAINT plan_template_seeds_item_key_chk CHECK (
    item_key ~ '^(tarea|objetivo):[a-z-]+:[a-z0-9-]+$'
    OR item_key ~ '^ciclo:[a-z0-9-]+:[0-9]{4}-(0[1-9]|1[0-2])$'
  );

COMMENT ON TABLE public.plan_template_seeds IS
  'Claves de tareas/objetivos estándar del plan ya creadas o vistas por cliente (tarea:, objetivo:, ciclo:<clave>:<AAAA-MM>). Lo que se borra no se vuelve a crear. Catálogo: src/lib/delivery/planChecklists.ts y planCycle.ts.';

-- 2. Tareas del ciclo: una por cliente, clave y mes ---------------------------
-- 2a. Duplicados previos (si los hay): se conserva el más antiguo con su marcador.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY client_id,
                        substring(description FROM '\[plantilla:[a-z]+:([a-z0-9-]+:[0-9]{4}-[0-9]{2})\]')
           ORDER BY created_at, id
         ) AS rn
  FROM public.client_tasks
  WHERE description ~ '\[plantilla:[a-z]+:[a-z0-9-]+:[0-9]{4}-[0-9]{2}\]'
)
UPDATE public.client_tasks t
SET description = replace(t.description, '[plantilla:', '[plantilla-dup:')
FROM ranked r
WHERE t.id = r.id AND r.rn > 1;

-- 2b. Índice único parcial por (cliente, clave:AAAA-MM).
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_tasks_client_plantilla_ciclo
  ON public.client_tasks (
    client_id,
    (substring(description FROM '\[plantilla:[a-z]+:([a-z0-9-]+:[0-9]{4}-[0-9]{2})\]'))
  )
  WHERE description ~ '\[plantilla:[a-z]+:[a-z0-9-]+:[0-9]{4}-[0-9]{2}\]';

-- 3. Recargar el esquema de PostgREST ----------------------------------------
NOTIFY pgrst, 'reload schema';
