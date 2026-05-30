
# Módulo Chatbot WhatsApp (Meta Cloud API)

Agrego una nueva sección "Chatbot" en el panel del cliente con tres pestañas: **Conversaciones**, **Respuestas automáticas** y **Métricas**. Cada cliente tiene su propio número WhatsApp Business conectado a Meta Cloud API.

---

## 1. Base de datos (una migración)

Tablas nuevas (todas con RLS via `owns_client(client_id)`):

- **`whatsapp_accounts`** — un registro por cliente
  - `client_id`, `phone_number_id` (Meta), `waba_id`, `display_phone_number`, `verify_token` (string aleatorio para el webhook), `access_token` (token permanente del cliente, encriptado a nivel app), `connected`, `last_synced_at`

- **`whatsapp_conversations`** — un hilo por contacto
  - `client_id`, `account_id`, `contact_wa_id` (teléfono), `contact_name`, `last_message_at`, `last_message_preview`, `unread_count`, `is_lead` (bool), `status` ('open'|'closed')

- **`whatsapp_messages`**
  - `conversation_id`, `client_id`, `wa_message_id`, `direction` ('inbound'|'outbound'), `from_bot` (bool), `type` ('text'|'image'|'audio'|'video'|'document'|'template'), `body`, `media_url`, `timestamp`, `status` ('sent'|'delivered'|'read'|'failed')

- **`whatsapp_bot_rules`** — respuestas automáticas configurables por cliente
  - `client_id`, `name`, `match_type` ('keyword'|'exact'|'starts_with'|'fallback'), `keywords` (text[]), `response_text`, `is_active`, `priority`, `mark_as_lead` (bool)

- **`whatsapp_metrics_daily`** (cache opcional, derivable)
  - `client_id`, `date`, `inbound_count`, `outbound_count`, `bot_responses`, `new_leads`, `unique_contacts`

---

## 2. UI — nueva sección "Chatbot"

Agrego item al sidebar en `src/routes/_app.tsx` (icono `MessageCircle`) → `/clients/$clientId/chatbot`.

Nueva ruta `src/routes/_app/clients/$clientId/chatbot.tsx` con tabs:

### Tab 1 — Conversaciones (default)
```
┌─────────────────┬─────────────────────────────┐
│ Lista chats     │ Hilo del chat seleccionado  │
│ (búsqueda,      │ (mensajes inbound/outbound, │
│  filtro lead,   │  diferenciados bot vs       │
│  unread badge)  │  humano, timestamps)        │
│                 │                             │
│                 │ [Marcar como lead] [Cerrar] │
└─────────────────┴─────────────────────────────┘
```
Solo lectura (sin enviar mensajes desde la app en esta fase).

### Tab 2 — Respuestas automáticas
Lista editable de reglas con: nombre, tipo de coincidencia, keywords (chips), texto de respuesta, prioridad, switch activo, switch "marcar como lead". Regla `fallback` única responde cuando nada coincide.

Estado de conexión arriba: si no hay `whatsapp_accounts` para el cliente, muestra wizard "Conectar WhatsApp" pidiendo: `phone_number_id`, `waba_id`, `access_token` permanente + genera el `verify_token` y muestra la **URL del webhook** (`https://vibranding.lovable.app/api/public/whatsapp/webhook/<account_id>`) y el `verify_token` para pegar en Meta.

### Tab 3 — Métricas
Cards: total mensajes (in/out), conversaciones activas, leads generados, tasa de respuesta del bot. Gráfico de líneas últimos 30 días (mensajes/día). Recharts.

---

## 3. Backend

### Webhook público (server route)
`src/routes/api/public/whatsapp/webhook/$accountId.ts`
- `GET` → verificación de Meta (`hub.challenge` si `hub.verify_token` coincide con el guardado)
- `POST` → recibe evento, busca/crea `whatsapp_conversations`, inserta `whatsapp_messages`, ejecuta motor de reglas, si matchea envía respuesta via Meta API y guarda mensaje outbound con `from_bot=true`. Usa `supabaseAdmin`.

### Server functions (`src/lib/whatsapp.functions.ts`)
- `listConversations(clientId)`, `listMessages(conversationId)`, `markConversationLead`, `closeConversation`
- `upsertWhatsappAccount`, `disconnectAccount`
- `listBotRules`, `upsertBotRule`, `deleteBotRule`
- `getMetrics(clientId, from, to)` — agrega desde `whatsapp_messages`

Todas con `requireSupabaseAuth` + chequeo `owns_client`.

### Motor de reglas (helper server-only)
Orden: prioridad DESC. Tipos: exact, starts_with, keyword (cualquier palabra del array dentro del mensaje), fallback. Si `mark_as_lead`, actualiza la conversación.

---

## 4. Secretos

No necesito secretos globales: cada cliente provee su propio `access_token` permanente de Meta (lo pega en el wizard, se guarda en `whatsapp_accounts.access_token`). El `verify_token` se genera automáticamente.

> Nota: Meta requiere App registrada y número verificado por cada cliente. Yo construyo la infra; el cliente final hace el setup en su Meta Business Manager y pega los IDs en la app.

---

## 5. Fuera de alcance (futuro)
- Enviar mensajes manualmente desde la app (intervención humana)
- Plantillas (HSM) para iniciar conversaciones fuera de ventana de 24h
- Multimedia outbound (solo texto en esta fase)
- Sincronización histórica (solo recibimos desde que el webhook está activo)

---

## 6. Archivos

Crear:
- migración SQL
- `src/routes/_app/clients/$clientId/chatbot.tsx`
- `src/components/chatbot/ConversationsTab.tsx`
- `src/components/chatbot/BotRulesTab.tsx`
- `src/components/chatbot/MetricsTab.tsx`
- `src/components/chatbot/ConnectWhatsAppWizard.tsx`
- `src/lib/whatsapp.functions.ts`
- `src/lib/whatsapp.server.ts` (motor de reglas + fetch a Meta)
- `src/routes/api/public/whatsapp/webhook/$accountId.ts`

Editar:
- `src/routes/_app.tsx` (item del sidebar)

---

¿Procedo? Empiezo por la migración, luego backend, luego UI.
