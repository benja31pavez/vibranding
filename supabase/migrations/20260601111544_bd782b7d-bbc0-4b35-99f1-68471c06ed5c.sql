CREATE OR REPLACE FUNCTION public.schedule_whatsapp_ai_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reply_enabled boolean;
  reply_delay integer;
BEGIN
  IF NEW.direction <> 'inbound' OR COALESCE(NEW.from_bot, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT
    wa.ai_enabled,
    GREATEST(15, COALESCE(wa.ai_debounce_seconds, 75))
  INTO reply_enabled, reply_delay
  FROM public.whatsapp_conversations wc
  JOIN public.whatsapp_accounts wa ON wa.id = wc.account_id
  WHERE wc.id = NEW.conversation_id;

  IF COALESCE(reply_enabled, false) THEN
    UPDATE public.whatsapp_conversations
    SET pending_response_at = now() + (reply_delay || ' seconds')::interval
    WHERE id = NEW.conversation_id
      AND COALESCE(ai_paused, false) = false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_whatsapp_ai_reply ON public.whatsapp_messages;

CREATE TRIGGER trg_schedule_whatsapp_ai_reply
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.schedule_whatsapp_ai_reply();