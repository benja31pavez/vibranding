# Primitivas de la plataforma (`@/components/app`)

Base visual de la plataforma interna (no de la home pública). Usa siempre estas
piezas en vez de armar tarjetas, estados vacíos o skeletons a mano.

```tsx
import {
  PageHeader,
  StatCard,
  Panel,
  EmptyState,
  ErrorState,
  ListSkeleton,
  TableSkeleton,
  Money,
  MoneyTotals,
  StatusBadge,
} from "@/components/app";
```

| Componente                       | Uso                                                                                                                                                                                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageContainer`                  | Raíz de cada pantalla bajo `/_app` (padding de Prospectos, alineado a la izquierda, `max-w-[1600px]`). `className` solo para `space-y-*`. Las pantallas de cliente ya lo reciben del layout `clients/$clientId`. Formularios angostos: limita el contenido interno con `max-w-*` **sin** `mx-auto`. |
| `PageHeader`                     | `title`, `description?`, `actions?`, `breadcrumb?: { label, to? }[]`. Un `h1` por pantalla.                                                                                                                                                                                                         |
| `StatCard`                       | KPI: `label`, `value`, `icon?`, `delta? { label, direction: "up"\|"down"\|"flat", invert? }`, `hint?`, `loading?`.                                                                                                                                                                                  |
| `Panel`                          | Card estándar: `title?`, `description?`, `icon?`, `actions?`, `tone?: "default"\|"warning"`, `children`.                                                                                                                                                                                            |
| `EmptyState`                     | `title`, `description?`, `icon?`, `action?`, `size?: "compact"` (dentro de un Panel).                                                                                                                                                                                                               |
| `ErrorState`                     | `message?`, `onRetry?`, `title?`. Tiene `role="alert"`. Nunca silencies un error de carga.                                                                                                                                                                                                          |
| `ListSkeleton` / `TableSkeleton` | En vez de "Cargando…". `rows`, `columns` (tabla), `label` para lectores de pantalla.                                                                                                                                                                                                                |
| `Money` / `MoneyTotals`          | Montos en CLP (`$149.990`, sin decimales). `Money` marca registros antiguos en otra moneda como "Moneda antigua (USD)"; `MoneyTotals` recibe `ClpTotals` (nunca suma otras monedas).                                                                                                                |
| `StatusBadge`                    | `status` (clave de BD en inglés) → etiqueta en español + color. `label`/`tone` para sobrescribir. Mapa en `STATUS_MAP`.                                                                                                                                                                             |

Patrón de carga: `loading → <Skeleton/>`, `error → <ErrorState onRetry/>`, `vacío → <EmptyState/>`, datos.

## Tokens (`src/styles.css`)

Los tokens de la plataforma son **aditivos**: no cambian `--radius`, `--primary` ni
las sombras por defecto, para no alterar la home ni los componentes shadcn públicos.

- **Superficies**: `bg-bg` (fondo de app), `bg-surface` (cards), `bg-surface-2` (zonas hundidas, encabezados de tabla).
- **Bordes**: `border-border-subtle` (cards), `border-border-strong` (hover, punteados).
- **Acento**: `primary`; marca con `text-brand-1|2|3` (íconos) y `bg-gradient-brand` (barras de avance).
- **Identidad** (`identity.css`, solo bajo `.app-brand`: AppShellFrame y PortalShell): halo de marca en el
  fondo, botón primario con degradado (`.btn-brand`, lo agrega `Button` si no trae `bg-…` propio),
  `bg-brand-soft` (estados activos, sin barra lateral), `card-brand` (hover de tarjetas).
  El título de `PageHeader` lleva su última palabra en Fraunces itálica con el degradado.
- **Estados**: `success`, `warning`, `danger`, `info` y `neutral`, cada uno con
  `-subtle` (fondo) y `-strong` (texto legible sobre el fondo subtle):
  `bg-success-subtle text-success-strong`.
- **Radios**: `rounded-app-sm` 6px (controles), `rounded-app-md` 8px, `rounded-app-lg` 14px (cards).
- **Sombras**: `shadow-app-xs` (cards en reposo), `shadow-app-md` (hover), `shadow-app-lg` (popovers).
- **Tipografía**: 12 `text-xs` · 13 `text-ui` · 14 `text-sm` · 16 `text-base` · 20 `text-xl` · 24 `text-2xl` · 30 `text-3xl`.
  Mínimo 12px: no uses `text-[8px]`…`text-[11px]`. Cifras y montos con `tabular-nums`.
- Dark mode: todos los tokens tienen valor bajo `.dark`.
