import { createFileRoute, Link } from "@tanstack/react-router";
import { Globe, Link2 } from "lucide-react";
import { useState } from "react";
import { MultilinkPage } from "@/components/pages/MultilinkPage";
import { LandingEditor } from "@/components/pages/LandingEditor";
import { UnsavedChangesGuard } from "@/components/site/SaveStatus";
import { FitPage, PageHeader } from "@/components/app";
import { cn } from "@/lib/utils";

type SitioTab = "multienlace" | "landing";

export const Route = createFileRoute("/_app/clients/$clientId/sitio")({
  validateSearch: (s: Record<string, unknown>): { tab?: SitioTab } => ({
    tab: s.tab === "landing" ? "landing" : s.tab === "multienlace" ? "multienlace" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sitio del cliente | Vibranding" },
      { name: "description", content: "Multienlace y landing page del cliente en un solo lugar." },
      { property: "og:title", content: "Sitio del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Multienlace y landing page del cliente en un solo lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SitioPage,
});

/**
 * Solo lectura: el cliente verá su sitio sin editarlo (vista previa grande + link
 * público). Aún no se activa para nadie: hoy los clientes solo entran a /portal.
 * Cuando esta pantalla se abra al cliente, actívalo con el tipo de usuario
 * (`resolveUserKind` en src/lib/auth/userKind.ts → `kind === "client"`).
 */
const READ_ONLY = false;

const PAGES: { value: SitioTab; label: string; icon: typeof Globe }[] = [
  { value: "multienlace", label: "Multienlace", icon: Link2 },
  { value: "landing", label: "Landing page", icon: Globe },
];

function SitioPage() {
  const { clientId } = Route.useParams();
  const { tab = "multienlace" } = Route.useSearch();
  const [dirtyMultilink, setDirtyMultilink] = useState(false);
  const [dirtyLanding, setDirtyLanding] = useState(false);
  const dirty: Record<SitioTab, boolean> = { multienlace: dirtyMultilink, landing: dirtyLanding };

  const switcher = (
    <nav aria-label="Páginas del sitio" className="flex items-center gap-1">
      {PAGES.map(({ value, label, icon: Icon }) => {
        const active = tab === value;
        return (
          <Link
            key={value}
            to="/clients/$clientId/sitio"
            params={{ clientId }}
            search={{ tab: value }}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-background text-foreground shadow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
            {dirty[value] && (
              <span
                className="h-2 w-2 rounded-full bg-warning"
                aria-label="con cambios sin guardar"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <FitPage header={<PageHeader size="compact" title="Sitio" />}>
      <UnsavedChangesGuard dirty={dirtyMultilink || dirtyLanding} />
      {/* Ambos editores quedan montados: cambiar de página no pierde cambios sin guardar. */}
      <div className={cn("md:h-full md:min-h-0", tab !== "multienlace" && "hidden")}>
        <MultilinkPage
          clientId={clientId}
          onDirtyChange={setDirtyMultilink}
          pageSwitcher={switcher}
          readOnly={READ_ONLY}
        />
      </div>
      <div className={cn("md:h-full md:min-h-0", tab !== "landing" && "hidden")}>
        <LandingEditor
          clientId={clientId}
          onDirtyChange={setDirtyLanding}
          pageSwitcher={switcher}
          readOnly={READ_ONLY}
        />
      </div>
    </FitPage>
  );
}
