import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Circle,
  Flag,
  Globe,
  LayoutDashboard,
  Instagram,
  Lock,
  MessageCircle,
  Receipt,
  Search,
  Settings2,
  UserPlus,
  Zap,
} from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { MetaIcon } from "@/components/icons/MetaIcon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";
import { useReviewAlerts } from "@/hooks/use-review-alerts";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/app";
import { CLIENT_SECTIONS, activeSectionCount, type SectionDef } from "@/lib/clientSections";

type IconComponent = ComponentType<{ className?: string }>;
type GroupKey = "operacion" | "negocio" | "ajustes";

const GROUPS: readonly { key: GroupKey; label: string }[] = [
  { key: "operacion", label: "Operación" },
  { key: "negocio", label: "Negocio" },
  { key: "ajustes", label: "Ajustes" },
];

/** Grupo de cada sección; una key que no esté aquí cae en "Operación". */
const SECTION_GROUP: Partial<Record<string, GroupKey>> = {
  plan: "operacion",
  instagram: "operacion",
  automatizacion: "operacion",
  bandeja: "operacion",
  sitio: "operacion",
  "meta-ads": "negocio",
  "google-ads": "negocio",
  leads: "negocio",
  facturacion: "negocio",
  analytics: "negocio",
};

/** Un icono distinto por sección (Facturación ≠ Analítica). */
const ICONS: Partial<Record<string, IconComponent>> = {
  plan: Flag,
  instagram: Instagram,
  "meta-ads": MetaIcon,
  "google-ads": Search,
  automatizacion: Zap,
  sitio: Globe,
  bandeja: MessageCircle,
  leads: UserPlus,
  facturacion: Receipt,
  analytics: BarChart3,
};

const groupOf = (key: string): GroupKey => SECTION_GROUP[key] ?? "operacion";

const itemClass = (isActive: boolean) =>
  cn(
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
  );

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : done / total;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" className="shrink-0" aria-hidden="true">
      <circle cx="11" cy="11" r={r} className="stroke-border" strokeWidth="2.5" fill="none" />
      <circle
        cx="11"
        cy="11"
        r={r}
        className="stroke-primary"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 11 11)"
      />
    </svg>
  );
}

interface SectionLinkProps {
  section: SectionDef;
  clientId: string;
  path: string;
  lockedReason: string | null;
  badge: number;
}

function SectionLink({ section, clientId, path, lockedReason, badge }: SectionLinkProps) {
  const Icon = ICONS[section.key] ?? Circle;
  const href = `/clients/${clientId}/${section.key}`;
  const isActive = path === href || path.startsWith(`${href}/`);

  if (lockedReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/clients/$clientId/setup"
            params={{ clientId }}
            className={cn(itemClass(false), "text-muted-foreground/60")}
          >
            <Icon className="h-4 w-4 shrink-0" /> {section.label}
            <span className="sr-only">(bloqueada: {lockedReason})</span>
            <Lock className="ml-auto h-3 w-3 shrink-0" aria-hidden="true" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{lockedReason}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      // Las rutas de sección siguen el patrón /clients/$clientId/<key>.
      to={`/clients/$clientId/${section.key}` as "/clients/$clientId"}
      params={{ clientId }}
      aria-current={isActive ? "page" : undefined}
      className={itemClass(isActive)}
    >
      <Icon className="h-4 w-4 shrink-0" /> {section.label}
      {badge > 0 && (
        <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-xs">
          {badge}
          <span className="sr-only"> pendientes</span>
        </Badge>
      )}
    </Link>
  );
}

export function ClientSidebarNav({
  clientId,
  path,
  staleOutcomes,
}: {
  clientId: string;
  path: string;
  staleOutcomes: number;
}) {
  const {
    caps,
    error: capsError,
    reload: reloadCaps,
    loading: capsLoading,
  } = useClientCapabilities(clientId);
  const { count: reviewCount } = useReviewAlerts(clientId);
  const setupHref = `/clients/${clientId}/setup`;
  const fichaHref = `/clients/${clientId}`;
  const onFicha = path === fichaHref || path === `${fichaHref}/`;
  const active = activeSectionCount(caps);

  const badgeFor = (key: string) => {
    if (key === "plan") return reviewCount;
    if (key === "bandeja") return staleOutcomes;
    return 0;
  };

  return (
    <nav aria-label="Secciones del cliente" className="space-y-5">
      {capsError && (
        <ErrorState
          title="No pudimos revisar las conexiones"
          message="Los candados del menú pueden no estar al día."
          onRetry={() => void reloadCaps()}
          retrying={capsLoading}
        />
      )}
      <Link
        to="/clients/$clientId"
        params={{ clientId }}
        aria-current={onFicha ? "page" : undefined}
        className={itemClass(onFicha)}
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 leading-tight">Ficha</span>
      </Link>
      {GROUPS.map((group) => {
        const sections = CLIENT_SECTIONS.filter((s) => groupOf(s.key) === group.key);
        const isSettings = group.key === "ajustes";
        if (sections.length === 0 && !isSettings) return null;
        const headingId = `client-nav-${group.key}`;
        return (
          <div key={group.key} role="group" aria-labelledby={headingId}>
            <div
              id={headingId}
              className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {sections.map((s) => (
                <li key={s.key}>
                  <SectionLink
                    section={s}
                    clientId={clientId}
                    path={path}
                    // Si no se pudo leer la conexión, no bloqueamos: cada pantalla muestra su estado.
                    lockedReason={capsError ? null : s.lockedReason(caps)}
                    badge={badgeFor(s.key)}
                  />
                </li>
              ))}
              {isSettings && (
                <li>
                  <Link
                    to="/clients/$clientId/setup"
                    params={{ clientId }}
                    aria-current={path === setupHref ? "page" : undefined}
                    className={itemClass(path === setupHref)}
                  >
                    <Settings2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block leading-tight">Configurar</span>
                      <span className="block text-xs font-normal leading-tight">
                        {active} de {CLIENT_SECTIONS.length} secciones activas
                      </span>
                    </span>
                    <ProgressRing done={active} total={CLIENT_SECTIONS.length} />
                  </Link>
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
