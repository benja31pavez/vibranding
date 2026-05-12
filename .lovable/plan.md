## Nueva estructura del menú izquierdo

```
Viralitycs
├─ GLOBAL
│  ├─ Dashboard          (/)  — pendientes, próximos pagos, KPIs
│  ├─ Clientes           (/clients)
│  ├─ Calendario         (/calendar) — publicaciones programadas de todos
│  ├─ Reportes           (/reports) — métricas agregadas
│  └─ Tarifas            (/settings/pricing)
│
├─ CLIENTE CONECTADO  (visible solo si hay uno activo)
│  ▸ [Avatar] Sori Sweet · @sorisweet.cl   [×]
│     ├─ Resumen        (/clients/:id)
│     ├─ Instagram      (/clients/:id/instagram)
│     ├─ Meta Ads       (/clients/:id/meta-ads)
│     ├─ Objetivos      (/clients/:id/objectives)
│     ├─ Entregables    (/clients/:id/deliverables)
│     └─ Pagos          (/clients/:id/payments)
│
└─ usuario@email · Cerrar sesión
```

Si no hay cliente conectado, el bloque "Cliente conectado" muestra "Sin cliente conectado" en gris. Al hacer click en una tarjeta de cliente queda como activo.

## Páginas nuevas

1. **Dashboard `/`** (después de login) — tarjetas con: clientes totales, próximos entregables (7 días), pagos vencidos / pendientes, próximas publicaciones programadas, ingresos del mes (suma de `payments.amount` con status `paid`).

2. **Calendario `/calendar`** — vista mensual con `instagram_posts.scheduled_at` de todos los clientes; cada evento coloreado por cliente, click abre el post.

3. **Reportes `/reports`** — agregados por cliente y totales:
   - Instagram: total posts publicados/programados, likes acumulados.
   - Meta Ads: spend, impressions, clicks, ROAS (suma de `meta_ads_insights`).
   - Ingresos: pagados vs pendientes por mes.
   - Filtro por rango de fechas y por cliente.

## Cambios en rutas existentes

- `/clients/$clientId` deja de usar `Tabs` internos. En su lugar:
  - `/clients/$clientId` → Resumen (lo que hoy es la pestaña "Resumen").
  - Se crean sub-rutas: `instagram.tsx`, `meta-ads.tsx`, `objectives.tsx`, `deliverables.tsx`, `payments.tsx` bajo `_app/clients/$clientId/`.
  - El layout `_app/clients/$clientId.tsx` mantiene el header del cliente (nombre, handle, eliminar, exportar PDF) y un `<Outlet/>`.
- La landing pública pasa de `/` a `/welcome` (o se mantiene `/` con redirect a `/dashboard` si hay sesión, lo que ya hace hoy → simplemente el "home" autenticado se vuelve el Dashboard).

## Detalles técnicos

- **Sidebar**: refactorizar `src/routes/_app.tsx` para usar el componente `Sidebar` de shadcn (`SidebarProvider`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`) y permitir colapsar a modo icono. Trigger en el header.
- **Cliente activo**: la lógica actual (URL match + `localStorage`) se conserva; se eleva a un `ActiveClientContext` para que las sub-rutas también lo lean sin re-fetch.
- **Sub-rutas del cliente**: cada sub-ruta carga solo los datos que necesita (no se carga IG completo al entrar a Pagos). Migrar el contenido actual de cada `TabsContent` a su archivo de ruta correspondiente.
- **Dashboard**: queries paralelas a `clients`, `deliverables` (status pending, due_date ≤ +7d), `payments` (pending/overdue), `instagram_posts` (scheduled_at futuro), `payments` (paid del mes).
- **Calendario**: usar el componente `Calendar` de shadcn como base + lista lateral de eventos del día seleccionado. Sin librería extra.
- **Reportes**: tablas + tarjetas con totales; sin gráficos en v1 (se puede agregar `recharts` después si quieres).
- **Rutas protegidas**: todo bajo `_app` ya redirige a `/login` si no hay sesión.

## Fuera de alcance

- Notificaciones, búsqueda global, multi-workspace, roles/permisos.
- Gráficos avanzados en Reportes (se puede agregar en otra iteración).
- Edición masiva de publicaciones desde el calendario (solo lectura + click → ir al post).
