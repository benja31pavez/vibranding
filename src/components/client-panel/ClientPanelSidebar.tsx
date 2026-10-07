import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ClientPanelUserMenu } from "./ClientPanelUserMenu";
import {
  CLIENT_PANEL_GROUPS,
  SUMMARY_ICON,
  sectionHref,
  type ClientPanelSection,
} from "./sections";
import type { ClientSelf } from "./useClientSelf";

const SUMMARY_HREF = "/mi";

/** Mismo estilo de ítem que el panel izquierdo de la agencia (ClientSidebarNav). */
const itemClass = (isActive: boolean) =>
  cn(
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive
      ? "brand-rail bg-sidebar-accent bg-brand-soft text-sidebar-accent-foreground [&>svg]:text-brand-1"
      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
  );

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : name.slice(0, 2)).toUpperCase();
}

/** Logo de la marca (de client_self) o sus iniciales. */
function BrandMark({ client }: { client: ClientSelf }) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(client.logoUrl) && !broken;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-9 w-9 shrink-0 select-none items-center justify-center overflow-hidden rounded-md text-xs font-semibold",
        showImage
          ? "rounded-full bg-surface ring-1 ring-border-subtle"
          : "bg-primary/10 text-primary",
      )}
    >
      {showImage && client.logoUrl ? (
        <img
          src={client.logoUrl}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        initialsOf(client.name)
      )}
    </span>
  );
}

/** Tarjeta fija de la marca: sin selector ni flecha (el cliente no cambia de cliente). */
export function ClientBrandCard({ client }: { client: ClientSelf }) {
  return (
    <div className="flex w-full min-w-0 items-center gap-2.5 rounded-lg border bg-background px-2.5 py-2 text-sm">
      <BrandMark client={client} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium leading-tight">{client.name}</span>
        {client.instagramHandle && (
          <span className="block truncate text-xs leading-tight text-muted-foreground">
            @{client.instagramHandle}
          </span>
        )}
      </span>
    </div>
  );
}

/** Búsqueda que conservan los enlaces (solo `preview` en la vista previa de la agencia). */
type PanelLinkSearch = { preview?: string };

function SectionLink({
  section,
  path,
  search,
}: {
  section: ClientPanelSection;
  path: string;
  search: PanelLinkSearch;
}) {
  const href = sectionHref(section.key);
  const isActive = path === href || path.startsWith(`${href}/`);
  const Icon = section.icon;
  return (
    <Link
      // Todas las secciones viven bajo /mi/<clave>: nunca enlaces a rutas de agencia.
      to={href as typeof SUMMARY_HREF}
      search={search}
      aria-current={isActive ? "page" : undefined}
      className={itemClass(isActive)}
    >
      <Icon className="h-4 w-4 shrink-0" /> {section.label}
    </Link>
  );
}

interface ClientPanelSidebarProps {
  client: ClientSelf;
  path: string;
  email: string | null;
  /** Sin él (vista previa de la agencia) no se muestra el menú de la cuenta. */
  onSignOut?: () => void;
  search?: PanelLinkSearch;
  /** Dentro del Sheet móvil: deja espacio a la X de cerrar junto a la tarjeta. */
  inSheet?: boolean;
}

/** Panel izquierdo del cliente: tarjeta de su marca, secciones y su cuenta. */
export function ClientPanelSidebar({
  client,
  path,
  email,
  onSignOut,
  search = {},
  inSheet = false,
}: ClientPanelSidebarProps) {
  const onSummary = path === SUMMARY_HREF || path === `${SUMMARY_HREF}/`;
  const SummaryIcon = SUMMARY_ICON;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("border-b py-3 pl-3", inSheet ? "pr-12" : "pr-3")}>
        <ClientBrandCard client={client} />
      </div>
      <nav
        aria-label="Secciones de tu marca"
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4"
      >
        <Link
          to={SUMMARY_HREF}
          search={search}
          aria-current={onSummary ? "page" : undefined}
          className={itemClass(onSummary)}
        >
          <SummaryIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 leading-tight">Resumen</span>
        </Link>
        {CLIENT_PANEL_GROUPS.map((group) => {
          const headingId = `mi-nav-${group.key}`;
          return (
            <div key={group.key} role="group" aria-labelledby={headingId}>
              <div
                id={headingId}
                className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                {group.label}
              </div>
              <ul className="space-y-0.5">
                {group.sections.map((s) => (
                  <li key={s.key}>
                    <SectionLink section={s} path={path} search={search} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      {onSignOut && (
        <div className="border-t px-3 py-3">
          <ClientPanelUserMenu email={email} onSignOut={onSignOut} />
        </div>
      )}
    </div>
  );
}
