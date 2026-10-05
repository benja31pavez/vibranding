-- Mensajería sin pérdida: contador de reintentos del dispatch de WhatsApp.
--
-- Idempotencia de webhooks: NO hace falta índice nuevo, ya existen:
--   * ig_automation_events_comment_uk  UNIQUE (comment_id)            (20260829220928)
--   * idx_wa_msg_waid                  UNIQUE (wa_message_id) WHERE wa_message_id IS NOT NULL
--                                                                       (20260530202926; cubre los mid de Instagram)
--
-- dispatch_attempts: veces que falló el envío de una respuesta IA ya reclamada.
-- Al 3er fallo el dispatch marca needs_human_followup = true y lo vuelve a 0.
-- El código funciona sin esta columna (reprograma sin contador ni escalamiento).
-- Idempotente: ADD COLUMN IF NOT EXISTS, con default (sin backfill manual).

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS dispatch_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE public.whatsapp_conversations
  DROP CONSTRAINT IF EXISTS whatsapp_conversations_dispatch_attempts_chk;
ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_dispatch_attempts_chk CHECK (dispatch_attempts >= 0);
