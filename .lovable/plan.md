
# Plan — Wizard Meta Ads (Campaña → Conjunto → Anuncio) con publicación real

Fase 1 únicamente. Tabla de campañas existentes, vista previa estilo Feed/Stories, sincronización inversa y gráfico temporal quedan para fase 2 (no se tocan ahora).

---

## 1. Base de datos (una sola migración)

Ampliar las tablas existentes con los campos que faltan para soportar todos los parámetros del Ads Manager.

**`meta_ads_campaigns`** — añadir:
- `buy_type` ('AUCTION' default), `bid_strategy` (LOWEST_COST_WITHOUT_CAP | LOWEST_COST_WITH_BID_CAP | COST_CAP | MINIMUM_ROAS)
- `cbo_enabled` boolean
- `spend_cap` numeric
- Constraint: si `cbo_enabled = true` debe tener `daily_budget` o `lifetime_budget`, no ambos
- Nuevo valor enum `ACTIVE` ya existe; se usa solo ACTIVE/PAUSED al publicar (DRAFT sigue siendo solo local)

**`meta_ads_adsets`** — añadir:
- `start_time`, `end_time` (timestamptz)
- `optimization_goal` ya existe → restringir a: LINK_CLICKS, IMPRESSIONS, REACH, LANDING_PAGE_VIEWS, OFFSITE_CONVERSIONS, LEAD_GENERATION, THRUPLAY
- `billing_event` ya existe → IMPRESSIONS | LINK_CLICKS
- `bid_amount` numeric
- `cities` text, `languages` text, `behaviors` text, `demographics` text
- `custom_audiences` text[], `lookalike_audiences` text[], `excluded_audiences` text[]
- `placement_mode` ('automatic' | 'manual')
- (placements text[] ya existe; ahora aceptará valores granulares: facebook_feed, facebook_stories, facebook_reels, facebook_marketplace, facebook_video_feeds, facebook_search, instagram_stream, instagram_stories, instagram_reels, instagram_explore, audience_network_classic, audience_network_rewarded_video, messenger_inbox, messenger_stories)
- `device_platforms` text[] ('mobile'|'desktop'), `user_os` text[] ('iOS'|'Android'), `wifi_only` boolean

**`meta_ads_ads`** — añadir:
- `page_id`, `instagram_actor_id` (override de la cuenta; default hereda de `meta_ads_accounts`)
- `display_url`, `utm_params` jsonb
- `carousel_cards` jsonb (array de `{image_url, video_url, headline, description, link_url, cta}`)
- `optimize_carousel_order` boolean, `multi_share_end_card` boolean
- `format`: ya existe → ampliar a 'image' | 'video' | 'carousel' | 'collection'
- `fb_creative_id`, `fb_adset_id` (para tracking)

---

## 2. UI — Wizard de 3 pasos

Reemplazar el formulario actual de `MetaAdsPanel` por un wizard. La lista de campañas existentes se mantiene intacta debajo.

```text
┌────────────────────────────────────────────────────────────┐
│  ● Campaña ───── ○ Conjunto ───── ○ Anuncio   [borrador]   │
├────────────────────────────────────────────────────────────┤
│  <Form del paso actual>                                    │
│                                                            │
│              [Guardar borrador]  [Atrás]  [Siguiente]      │
└────────────────────────────────────────────────────────────┘
```

**Componentes nuevos** (en `src/components/meta-ads/`):
- `WizardShell.tsx` — barra de progreso, navegación, "Guardar borrador"
- `Step1Campaign.tsx` — todos los campos de campaña + validación zod
- `Step2AdSet.tsx` — segmentación, placements, optimización; secciones colapsables
- `Step3Ad.tsx` — identidad, formato (tabs: imagen / video / carrusel / colección), creativo con `MediaUpload` y contadores de caracteres
- `CarouselCardsEditor.tsx` — repetidor 2–10 tarjetas
- `PlacementsPicker.tsx` — toggle automático/manual + checkboxes agrupados
- `CountriesPicker.tsx` — multiselect con búsqueda (lista ISO local)
- `TagsInput.tsx` — chips para intereses / comportamientos / audiencias
- `UtmBuilder.tsx` — source/medium/campaign/term/content
- `PublishConfirmModal.tsx` — resumen completo antes de enviar a Meta

**Esquema de validación**: un `zod` por paso. Estado: cada nivel marca `draft | complete | error`. "Publicar en Meta" solo se habilita cuando los 3 están `complete`.

**UX**:
- Cada paso colapsable una vez completado (se reabre con clic en su pill de la barra)
- Validación inline en cada campo (rojo + mensaje)
- Contadores 125/40/30 caracteres en texto principal / titular / descripción
- "Guardar borrador" hace upsert a las 3 tablas con `status='DRAFT'`
- Tras publicar OK: modal con el `fb_campaign_id` retornado + link `https://business.facebook.com/adsmanager/manage/campaigns?act={ad_account_id}&selected_campaign_ids={fb_campaign_id}`

---

## 3. Publicación real a Meta API

Nuevo endpoint `src/routes/api/meta-ads/publish-full.ts` (POST `{ campaignId }`). Reemplaza al actual `create-campaign.ts` (se mantiene por compatibilidad pero deja de usarse en el wizard).

Pasos del handler:

1. **Validar ownership** vía RLS (cliente Supabase con token del usuario).
2. **Cargar** campaña + adsets + ads + meta_ads_accounts (page_id, instagram_actor_id, ad_account_id).
3. **Subir creativos** que sean URLs públicas del bucket:
   - Imágenes → `POST /act_X/adimages` con `bytes` (base64) o `url` → devuelve `image_hash`
   - Videos → `POST /act_X/advideos` con `file_url` → devuelve `video_id`
   - Guardar hashes en memoria
4. **Crear campaña** → `POST /act_X/campaigns` con `name, objective, status (ACTIVE/PAUSED), special_ad_categories=[], bid_strategy, buying_type=AUCTION, spend_cap?, daily_budget? | lifetime_budget?` (solo si CBO).
5. **Por cada adset** → `POST /act_X/adsets` con:
   - `campaign_id`, `name`, `status`
   - `daily_budget` / `lifetime_budget` (solo si CBO está off)
   - `start_time`, `end_time`, `optimization_goal`, `billing_event`, `bid_amount?`
   - `targeting` (JSON): `{ geo_locations: { countries, cities }, age_min, age_max, genders, locales, flexible_spec: [{ interests, behaviors, demographics }], custom_audiences, excluded_custom_audiences, device_platforms, user_os, wireless_carrier (wifi_only) }`
   - `targeting.publisher_platforms` + `facebook_positions` + `instagram_positions` + `audience_network_positions` + `messenger_positions` cuando `placement_mode='manual'`. Si automático: omitir todo eso.
6. **Por cada ad** → primero `POST /act_X/adcreatives` con `object_story_spec`:
   - Imagen única: `{ page_id, instagram_actor_id, link_data: { image_hash, link, message, name, description, call_to_action: { type, value: { link } } } }`
   - Video único: `{ page_id, instagram_actor_id, video_data: { video_id, image_hash (thumb), message, title, call_to_action } }`
   - Carrusel: `link_data.child_attachments[]` con `{ image_hash|video_id, link, name, description, call_to_action }` + `multi_share_optimized`, `multi_share_end_card`
   - Luego `POST /act_X/ads` con `{ name, adset_id, creative: { creative_id }, status }`
7. **Guardar IDs** retornados en cada fila (`fb_campaign_id`, `fb_adset_id`, `fb_ad_id`, `fb_creative_id`) y marcar `status='ACTIVE' | 'PAUSED'`.
8. **Manejo de errores**: si falla en el paso N, marcar la entidad correspondiente con el error en `notes`, devolver el detalle al cliente y dejar lo creado en Meta como está (no se puede rollback fácilmente). Mensaje en español.

UTM: si `utm_params` está presente, anexarlos al `link_url` final antes de enviar a Meta.

---

## 4. Subida de archivos

Se reutiliza `MediaUpload` existente (bucket `client-media`, ya público). El backend, al publicar, pasa la URL pública a Meta como `url` (para imágenes) o `file_url` (para videos). No hace falta endpoint nuevo de upload.

---

## 5. Fuera de alcance de esta fase

- Tabla de campañas con métricas/CPC/CTR/ROAS y filtros/orden
- Sincronización inversa Meta→DB con detección de diferencias
- Toggle pausar/activar en tabla
- Gráfico temporal de métricas
- Vista previa visual estilo Facebook Feed / IG Stories
- Formato "Colección" (UI sí, publicación a Meta queda como TODO)
- Audiencias personalizadas/lookalike: solo input de IDs (selector real contra `/customaudiences` viene en fase 2)

---

## 6. Archivos a crear / editar

Crear:
- `supabase/migrations/<ts>_meta_ads_full_schema.sql`
- `src/components/meta-ads/WizardShell.tsx`
- `src/components/meta-ads/Step1Campaign.tsx`
- `src/components/meta-ads/Step2AdSet.tsx`
- `src/components/meta-ads/Step3Ad.tsx`
- `src/components/meta-ads/CarouselCardsEditor.tsx`
- `src/components/meta-ads/PlacementsPicker.tsx`
- `src/components/meta-ads/CountriesPicker.tsx`
- `src/components/meta-ads/TagsInput.tsx`
- `src/components/meta-ads/UtmBuilder.tsx`
- `src/components/meta-ads/PublishConfirmModal.tsx`
- `src/lib/meta-ads/constants.ts` (objetivos, CTAs, placements, países ISO)
- `src/lib/meta-ads/schemas.ts` (validación zod por paso)
- `src/routes/api/meta-ads/publish-full.ts`

Editar:
- `src/components/MetaAdsPanel.tsx` — reemplazar formulario por `<WizardShell>`, mantener lista de campañas
- `src/integrations/supabase/types.ts` (se regenera tras la migración)

---

¿Te late este alcance? Si sí, ejecuto la migración primero y después construyo el wizard + endpoint.
