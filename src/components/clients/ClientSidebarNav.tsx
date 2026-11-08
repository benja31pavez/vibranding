import { Link } from "@tanstack/react-router";
import {
  Scale,
  BarChart3,
  CalendarDays,
  Circle,
  Flag,
  Globe,
  Images,
  LayoutDashboard,
  Instagram,
  Lock,
  MessageCircle,
  Receipt,
  Search,
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
import { CLIENT_SECTIONS, type SectionDef, type SectionKey } from "@/lib/clientSections";
import type { ConnectionKey } from "@/components/setup/connectionModel";

type IconComponent = ComponentType<{ className?: string }>;
type GroupKey = "operacion" | "conexiones" | "negocio";

/** Grupos del menú y el orden de sus secciones. */
const GROUPS: readonly { key: GroupKey; label: string; sections: readonly string[] }[] = [
  { key: "operacion", label: "Principal", sections: ["plan", "calendario", "archivos", "sitio"] },
  {
    key: "conexiones",
    label: "Marketing",
    sections: ["instagram", "bandeja", "meta-ads", "google-ads"],
  },
  { key: "negocio", label: "Negocio", sections: ["leads", "facturacion", "legal", "analytics"] },
];

/** Conexión que desbloquea cada sección con candado (abre directo esa conexión en Conexiones). */
const UNLOCKED_BY: Partial<Record<SectionKey, ConnectionKey>> = {
  instagram: "instagram",
  automatizacion: "instagram",
  bandeja: "whatsapp",
  "meta-ads": "meta-ads",
  analytics: "meta-ads",
  "google-ads": "google-ads",
};

const GROUPED = new Set(GROUPS.flatMap((g) => g.sections));

/** Secciones visibles de un grupo, en su orden; las sin grupo caen al final de "Operación". */
function sectionsOf(group: (typeof GROUPS)[number]): SectionDef[] {
  const listed = group.sections.flatMap((key) => CLIENT_SECTIONS.filter((s) => s.key === key));
  if (group.key !== "operacion") return listed;
  return [...listed, ...CLIENT_SECTIONS.filter((s) => !GROUPED.has(s.key))];
}

/** Un icono distinto por sección (Facturación ≠ Analítica). */
const ICONS: Partial<Record<string, IconComponent>> = {
  plan: Flag,
  calendario: CalendarDays,
  archivos: Images,
  instagram: Instagram,
  "meta-ads": MetaIcon,
  "google-ads": Search,
  automatizacion: Zap,
  sitio: Globe,
  bandeja: MessageCircle,
  leads: UserPlus,
  facturacion: Receipt,
  legal: Scale,
  analytics: BarChart3,
};

/* Los colores los pone .shell-sidebar-indigo (identity.css) según sb-item / sb-active / sb-locked. */
const itemClass = (isActive: boolean) =>
  cn(
    "sb-item flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    "focus-visible:outline-none",
    isActive && "sb-active",
  );

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
            search={{ conexion: UNLOCKED_BY[section.key] }}
            className={cn(itemClass(false), "sb-locked")}
          >
            <Icon className="h-4 w-4 shrink-0" /> {section.label}
            <span className="sr-only">(bloqueada: {lockedReason})</span>
            <span
              aria-hidden="true"
              className="ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
            >
              Conectar <Lock className="h-3 w-3 shrink-0" />
            </span>
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
  // "Resumen" vive en /clients/<id>/ficha; la gestión de la agencia (/clients/<id>) no marca nada aquí.
  const summaryHref = `/clients/${clientId}/ficha`;
  const onSummary = path === summaryHref || path === `${summaryHref}/`;

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
        to="/clients/$clientId/ficha"
        params={{ clientId }}
        aria-current={onSummary ? "page" : undefined}
        className={itemClass(onSummary)}
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 leading-tight">Panel</span>
      </Link>
      {GROUPS.map((group) => {
        const sections = sectionsOf(group);
        if (sections.length === 0) return null;
        const headingId = `client-nav-${group.key}`;
        return (
          <div key={group.key} role="group" aria-labelledby={headingId}>
            <div
              id={headingId}
              className="sb-group px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em]"
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
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
