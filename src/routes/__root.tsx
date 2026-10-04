import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { translations } from "@/i18n/translations";
import { LEGAL_NAME, ORGANIZATION_ID, SITE_URL, WHATSAPP_E164 } from "@/lib/site";

const DEFAULT_SEO = translations.es.seo.home;
const FRAUNCES_CSS =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,600&display=swap";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-semibold tracking-tight">404</h1>
        <p className="mt-3 text-muted-foreground">Esta página no existe.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo salió mal</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: DEFAULT_SEO.title },
      { name: "description", content: DEFAULT_SEO.description },
      { property: "og:title", content: DEFAULT_SEO.title },
      { name: "twitter:title", content: DEFAULT_SEO.title },
      { property: "og:description", content: DEFAULT_SEO.description },
      { name: "twitter:description", content: DEFAULT_SEO.description },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2930eeea-27b9-495c-932b-005c7b79e815/id-preview-f7ff2cc0--e7caaa14-14c5-42d8-b5b5-4cde48ca5360.lovable.app-1779051473659.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/2930eeea-27b9-495c-932b-005c7b79e815/id-preview-f7ff2cc0--e7caaa14-14c5-42d8-b5b5-4cde48ca5360.lovable.app-1779051473659.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Vibranding" },
      { property: "og:locale", content: "es_CL" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preload", as: "style", href: FRAUNCES_CSS },
      { rel: "stylesheet", href: FRAUNCES_CSS },
      { rel: "stylesheet", href: appCss },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": ORGANIZATION_ID,
              name: "Vibranding",
              legalName: LEGAL_NAME,
              url: SITE_URL,
              // TODO: reemplazar por un logo PNG cuadrado de al menos 112x112 px (p. ej. public/logo.png).
              logo: `${SITE_URL}/favicon.ico`,
              telephone: WHATSAPP_E164,
              address: { "@type": "PostalAddress", addressLocality: "Santiago", addressCountry: "CL" },
            },
            {
              "@type": "WebSite",
              name: "Vibranding",
              url: SITE_URL,
              inLanguage: "es-CL",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <Outlet />
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
