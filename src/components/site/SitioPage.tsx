import { Globe, Link2, BarChart3 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { FitPage, PageHeader, Panel, SectionTabs, type SectionTab } from "@/components/app";
import { LandingEditor } from "@/components/pages/LandingEditor";
import { MultilinkPage } from "@/components/pages/MultilinkPage";
import { cn } from "@/lib/utils";
import { UnsavedChangesGuard } from "./SaveStatus";
import { SitioResumen } from "./SitioResumen";
import type { SiteSection, SitioPagina, SitioTab } from "./siteSections";

/**
 * Solo lectura: el cliente verá su sitio sin editarlo (vista previa grande + link
 * público). Aún no se activa para nadie: hoy los clientes solo entran a /portal.
 * Cuando esta pantalla se abra al cliente, actívalo con el tipo de usuario
 * (`resolveUserKind` en src/lib/auth/userKind.ts → `kind === "client"`).
 */
const READ_ONLY = false;

const TABS: readonly SectionTab<SitioTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "secciones", label: "Secciones" },
  {
    key: "dominio",
    // En teléfono el nombre completo no cabe en la barra de cuatro pestañas.
    label: (
      <>
        <span className="md:hidden">Dominio</span>
        <span className="hidden md:inline">Dominio y conexiones</span>
      </>
    ),
  },
  { key: "analitica", label: "Analítica" },
];

const PAGES: { value: SitioPagina; label: string; icon: typeof Globe }[] = [
  { value: "landing", label: "Landing page", icon: Globe },
  { value: "multienlace", label: "Multienlace", icon: Link2 },
];

const DESCRIPTION: Readonly<Record<SitioTab, string>> = {
  resumen: "Estado de la landing y el multienlace, con sus links públicos",
  secciones: "Edita el contenido y la vista previa de cada página",
  dominio: "Publicar, dirección pública, QR, WhatsApp y SEO",
  analitica: "Visitas, clics y mensajes de cada página",
};

interface SitioPageProps {
  clientId: string;
  tab: SitioTab;
  onTabChange: (tab: SitioTab) => void;
  pagina: SitioPagina;
  onPaginaChange: (pagina: SitioPagina) => void;
}

/**
 * "Sitio" del cliente, con cuatro subsecciones: Resumen, Secciones (editor), Dominio y
 * conexiones (publicar, URL, QR, ajustes) y Analítica. En las tres últimas se elige la
 * página (landing o multienlace); ambos editores quedan montados para no perder cambios
 * sin guardar al cambiar de pestaña o de página.
 */
export function SitioPage({ clientId, tab, onTabChange, pagina, onPaginaChange }: SitioPageProps) {
  const [dirtyMultilink, setDirtyMultilink] = useState(false);
  const [dirtyLanding, setDirtyLanding] = useState(false);
  const dirty: Record<SitioPagina, boolean> = {
    multienlace: dirtyMultilink,
    landing: dirtyLanding,
  };
  const section: SiteSection = tab === "resumen" ? "secciones" : tab;

  const open = (next: SiteSection, page: SitioPagina) => {
    onPaginaChange(page);
    onTabChange(next);
  };

  const switcher = (
    <div role="group" aria-label="Página del sitio" className="flex items-center gap-1">
      {PAGES.map(({ value, label, icon: Icon }) => {
        const active = pagina === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onPaginaChange(value)}
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
                role="img"
                aria-label="con cambios sin guardar"
              />
            )}
          </button>
        );
      })}
    </div>
  );

  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader size="compact" title="Sitio" description={DESCRIPTION[tab]} />
      <SectionTabs tabs={TABS} value={tab} onChange={onTabChange} label="Vistas del sitio" />
    </div>
  );

  const showEditors = tab !== "resumen";
  const editorVisible = (page: SitioPagina) => showEditors && pagina === page;

  return (
    <FitPage header={header} contentClassName="flex flex-col gap-4 md:gap-3">
      <UnsavedChangesGuard dirty={dirtyMultilink || dirtyLanding} />
      {tab === "resumen" && <SitioResumen clientId={clientId} onOpen={open} />}
      {tab === "dominio" && <PixelsNotice />}
      {/* Ambos editores quedan montados: cambiar de pestaña o de página no pierde cambios. */}
      <EditorSlot visible={editorVisible("multienlace")}>
        <MultilinkPage
          clientId={clientId}
          onDirtyChange={setDirtyMultilink}
          pageSwitcher={switcher}
          readOnly={READ_ONLY}
          section={section}
        />
      </EditorSlot>
      <EditorSlot visible={editorVisible("landing")}>
        <LandingEditor
          clientId={clientId}
          onDirtyChange={setDirtyLanding}
          pageSwitcher={switcher}
          readOnly={READ_ONLY}
          section={section}
          onSectionChange={onTabChange}
        />
      </EditorSlot>
    </FitPage>
  );
}

function EditorSlot({ visible, children }: { visible: boolean; children: ReactNode }) {
  return (
    <div
      className={cn(
        "md:flex md:min-h-0 md:flex-1 md:flex-col [&>*]:md:min-h-0 [&>*]:md:flex-1",
        !visible && "hidden",
      )}
    >
      {children}
    </div>
  );
}

/**
 * Aviso honesto: los píxeles de Meta y Google Analytics todavía no se configuran por
 * cliente; las visitas y clics se miden con el seguimiento propio (ver Analítica).
 */
function PixelsNotice() {
  return (
    <Panel
      title="Píxeles y seguimiento"
      icon={BarChart3}
      className="shrink-0"
      bodyClassName="text-sm text-muted-foreground"
    >
      Los píxeles de Meta y Google Analytics aún no se pueden conectar desde aquí. Las visitas,
      clics a WhatsApp y envíos del formulario se miden con el seguimiento propio de Vibranding y se
      ven en la pestaña Analítica.
    </Panel>
  );
}
