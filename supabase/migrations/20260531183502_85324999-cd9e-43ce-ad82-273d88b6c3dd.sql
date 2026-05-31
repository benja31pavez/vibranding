
-- Extensiones para el cron interno
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Config IA por cuenta
ALTER TABLE public.whatsapp_accounts
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_system_prompt text NOT NULL DEFAULT 'Eres un asistente comercial amable y conciso. Responde en el mismo idioma del cliente. Si no sabes algo, dilo y ofrece contactar al equipo humano.',
  ADD COLUMN IF NOT EXISTS ai_model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  ADD COLUMN IF NOT EXISTS ai_debounce_seconds integer NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS ai_max_history integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS ai_business_context text;

-- Estado de debounce y override humano por conversación
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS pending_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_bot_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_conv_pending
  ON public.whatsapp_conversations (pending_response_at)
  WHERE pending_response_at IS NOT NULL;

-- Cron: cada 20s pega al endpoint público de procesamiento
-- Usamos la URL publicada estable del proyecto
DO $$
DECLARE
  job_id bigint;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'whatsapp_ai_dispatch';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;

  PERFORM cron.schedule(
    'whatsapp_ai_dispatch',
    '20 seconds',
    $cron$
      SELECT net.http_post(
        url := 'https://project--e7caaa14-14c5-42d8-b5b5-4cde48ca5360.lovable.app/api/public/whatsapp/dispatch',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{}'::jsonb,
        timeout_milliseconds := 15000
      ) AS request_id;
    $cron$
  );
END $$;
