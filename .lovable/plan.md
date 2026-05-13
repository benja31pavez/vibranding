## Mejoras propuestas

### 1. Objetivos
- **Prioridad** (alta/media/baja) con badge de color y orden por prioridad + fecha.
- **Métrica medible**: campo opcional `target_value` + `current_value` + `unit` (ej: "Llegar a 10.000 seguidores"), con barra de progreso visual.
- **Categoría** (Crecimiento, Engagement, Ventas, Branding) con icono.
- **Vinculación a entregables**: marcar qué entregables aportan a cada objetivo.
- **Indicador de vencimiento**: pill rojo si la fecha pasó y no está completado.

### 2. Entregables
- **Vista Kanban** opcional (Pendiente / En curso / Completado) además del listado.
- **Tipo** (Post, Reel, Historia, Diseño, Reunión, Reporte) con icono.
- **Asignar a un post de Instagram**: si el entregable es contenido, vincularlo al post programado del calendario.
- **Subtareas / checklist** dentro de cada entregable.
- **Adjuntos** (imagen / link de referencia) usando el storage existente.
- **Filtros** por estado, tipo y rango de fechas; **agrupación por semana**.

### 3. Resumen del cliente
- **Hero del cliente**: avatar grande, handle, métricas IG (seguidores, posts, engagement) en una fila.
- **Próximas acciones**: lista de los 3 entregables y posts más cercanos.
- **Salud del proyecto**: 3 indicadores tipo semáforo (Objetivos en plazo, Entregables al día, Pagos al día).
- **Mini-timeline de 30 días**: actividad reciente (post publicado, pago recibido, entregable completado).
- **Mini-preview de Instagram** (3-6 posts del feed propuesto) con CTA "Ver Instagram".
- **Resumen financiero compacto** (cobrado vs pendiente vs propuesto) con barra apilada en lugar de solo número.

### 4. Landing page (cómo se ve hoy)
La landing en `/` está implementada con:
- Header + nav (Servicios / Cómo funciona / Contacto) + Iniciar sesión.
- Hero centrado: "Hacemos que tu marca se vuelva viral".
- 3 tarjetas de servicios (Instagram, Meta Ads, Reportes).
- Sección "Cómo trabajamos" en 3 pasos.
- CTA de contacto con email `hola@viralitycs.com` y WhatsApp.
- Footer minimalista.

Para verla: cierra sesión o abre `/` en una ventana privada (si hay sesión te redirige a `/dashboard`). Puedo agregar un enlace "Ver landing" en el menú de usuario para revisarla sin cerrar sesión.

### 5. Footer estilo de la imagen (FAQ / TOS / Privacidad / Cookies)
Replicar el bloque de la foto, adaptado a Viralitycs:
- **Footer ampliado** en la landing con 4 columnas:
  - Producto: Servicios, Cómo funciona, Contacto.
  - Recursos: **Preguntas Frecuentes** (`/faq`).
  - Legal: **Términos de Servicio** (`/terms`), **Política de Privacidad** (`/privacy`), **Cookies** (`/cookies`).
  - Marca: logo Viralitycs + tagline + email.
- Línea inferior: `© 2026 Viralitycs. Todos los derechos reservados.`
- Crear las 4 páginas con contenido base editable (FAQ con 6-8 preguntas iniciales, los 3 documentos legales con plantilla estándar para agencia de marketing en Chile/LatAm).
- Agregar los enlaces también en el footer de `_app` (área autenticada) para que sean accesibles desde dentro de la app.

## Detalles técnicos

- **Objetivos**: migración para añadir `priority`, `category`, `target_value numeric`, `current_value numeric`, `unit text` a `objectives`. Tabla pivote opcional `objective_deliverables(objective_id, deliverable_id)`.
- **Entregables**: añadir `type` (enum: post/reel/story/design/meeting/report/other), `instagram_post_id uuid null` (FK a `instagram_posts`), `checklist jsonb` (array `{text, done}`), `attachments jsonb`. Vista Kanban con `@dnd-kit/core` (ya disponible en shadcn) — reutiliza `Tabs` si prefieres no añadir DnD en v1.
- **Resumen**: nuevo componente `ClientHealth` (3 semáforos), `RecentActivity` (consulta unificada de los últimos 10 eventos por cliente), `MiniFeed` (primeros posts ordenados de `instagram_posts`).
- **Landing/legal**: 4 nuevas rutas (`/faq`, `/terms`, `/privacy`, `/cookies`) con `head()` propio (title, description, og). Footer extraído a `src/components/SiteFooter.tsx` reutilizable en landing y legales.
- Sin cambios en auth ni en backend para landing/legal.

## Fuera de alcance
- DnD avanzado en Kanban (v1 con clic-cambia-estado).
- Notificaciones, recordatorios automáticos por email.
- Generador de FAQ dinámica desde DB (texto estático en v1, fácil de mover a DB después).
