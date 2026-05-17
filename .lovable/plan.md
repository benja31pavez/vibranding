
## Objetivo
Hacer el landing público disponible en español (idioma por defecto) e inglés, con un selector visible para que visitantes de EE.UU. puedan leerlo en su idioma.

## Alcance
Solo el contenido público no autenticado:
- `/` (landing en `src/routes/index.tsx`)
- Footer compartido (`src/components/SiteFooter.tsx`)
- Páginas legales y de soporte: `/faq`, `/terms`, `/privacy`, `/cookies`, `/data-deletion`
- Metadatos SEO (`head()`) de cada ruta anterior

Fuera de alcance: la app autenticada (`/dashboard`, clientes, objetivos, etc.) y `/login`. Se mantienen solo en español.

## Enfoque

### 1. Sistema de i18n ligero (sin librería externa)
Crear un contexto simple en `src/i18n/`:
- `src/i18n/LanguageContext.tsx`: provider con `language` (`"es" | "en"`), `setLanguage`, y hook `useT()` que devuelve la función de traducción.
- `src/i18n/translations.ts`: objeto anidado con todas las cadenas del landing y páginas legales en `es` y `en`.
- Persistencia en `localStorage` (`vibranding:lang`).
- Detección inicial: si no hay valor guardado, usar `navigator.language` — `en*` → inglés, cualquier otro → español (default).
- En SSR, default a español para evitar parpadeo; tras hidratar se ajusta si el usuario tiene preferencia distinta.

Se evita añadir `react-i18next` para no inflar el bundle; el contenido es estático y limitado.

### 2. Selector de idioma (UI)
- Botón compacto `ES / EN` en el header del landing (junto a "Iniciar sesión") y en el header de `LegalPage.tsx`.
- Estilo: dos pills pequeñas, la activa con fondo `bg-foreground/10` y la otra como link `text-muted-foreground`.
- También una versión opcional en el footer para accesibilidad.

### 3. Integración del provider
Envolver el árbol en `src/routes/__root.tsx` con `<LanguageProvider>` para que todas las rutas públicas tengan acceso. No afecta a la app autenticada (simplemente no lo usa).

### 4. Reemplazo de texto en las rutas públicas
Sustituir cadenas hardcodeadas por `t("clave.subclave")` en:
- `src/routes/index.tsx` (hero, servicios, "Cómo trabajamos", CTA contacto, nav)
- `src/components/SiteFooter.tsx` (columnas y enlaces)
- `src/routes/faq.tsx`, `terms.tsx`, `privacy.tsx`, `cookies.tsx`, `data-deletion.tsx`

### 5. SEO por idioma
Cada `head()` se ajusta:
- Mantener título/descripción en español por defecto en el HTML inicial (SSR).
- Añadir `<link rel="alternate" hreflang="es" href=".../">` y `hreflang="en" href=".../?lang=en">` y `x-default`.
- Soportar `?lang=en` en la URL para que un enlace compartido abra directamente en inglés (el provider lo lee al montar y lo guarda).

No se crean rutas `/en/...` separadas para mantener el alcance acotado; el contenido cambia client-side via contexto + `?lang=en` para deep-linking.

## Detalles técnicos
- Claves planas tipo `landing.hero.title`, `landing.services.instagram.title`, `footer.columns.legal`, `legal.terms.body`, etc.
- Los textos largos de las páginas legales se guardan como bloques de JSX renderizado desde el componente, pero los encabezados, párrafos y listas se externalizan a las traducciones (arrays de strings por sección).
- Tipado: `type Lang = "es" | "en"`; `translations: Record<Lang, Dict>` con `Dict` derivado del objeto español como fuente de verdad para evitar claves faltantes.
- WhatsApp: el mensaje pre-llenado también se traduce (saludo en inglés cuando `lang=en`).

## Fuera de alcance
- Traducción de la app interna autenticada.
- Detección por geolocalización IP (solo `navigator.language`).
- Rutas separadas por idioma (`/en/...`) — se puede añadir después si SEO en inglés lo requiere.
