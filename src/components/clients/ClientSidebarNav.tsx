import { Link } from "@tanstack/react-router";
import {
  BarChart3, CheckSquare, Globe, Instagram, Lock, MessageCircle, Settings2, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MetaIcon } from "@/components/icons/MetaIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";
import { useReviewAlerts } from "@/hooks/use-review-alerts";
import { CLIENT_SECTIONS, activeSectionCount, type SectionKey } from "@/lib/clientSections";

const ICONS: Record<SectionKey, (p: { className?: string }) => JSX.Element> = {
  plan: CheckSquare,
  instagram: Instagram,
  "meta-ads": MetaIcon,
  automatizacion: Zap,
  sitio: Globe,
  bandeja: MessageCircle,
  facturacion: BarChart3,
  analytics: BarChart3,
};


const ROUTES: Record<SectionKey, string> = {
  plan: "/clients/$clientId/plan",
  instagram: "/clients/$clientId/instagram",
  "meta-ads": "/clients/$clientId/meta-ads",
  automatizacion: "/clients/$clientId/automatizacion",
  sitio: "/clients/$clientId/sitio",
  bandeja: "/clients/$clientId/bandeja",
  facturacion: "/clients/$clientId/facturacion",
  analytics: "/clients/$clientId/analytics",
};

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : done / total;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" className="shrink-0">
      <circle cx="11" cy="11" r={r} className="stroke-border" strokeWidth="2.5" fill="none" />
      <circle
        cx="11" cy="11" r={r}
        className="stroke-primary" strokeWidth="2.5" fill="none" strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 11 11)"
      />
    </svg>
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
  const { caps } = useClientCapabilities(clientId);
  const { count: reviewCount } = useReviewAlerts(clientId);
  const base = `/clients/${clientId}`;
  const active = activeSectionCount(caps);

  const itemClass = (isActive: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
    }`;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-1.5 pt-2">
        <Link
          to="/clients/$clientId/setup"
          params={{ clientId }}
          className={`${itemClass(path === `${base}/setup`)} border border-dashed border-border`}
        >
          <ProgressRing done={active} total={CLIENT_SECTIONS.length} />
          <span className="min-w-0">
            <span className="block leading-tight">Configurar</span>
            <span className="block text-[11px] font-normal leading-tight">
              {active} de {CLIENT_SECTIONS.length} secciones activas
            </span>
          </span>
        </Link>

        {CLIENT_SECTIONS.map((s) => {
          const Icon = ICONS[s.key];
          const reason = s.lockedReason(caps);
          const isActive = path.startsWith(`${base}/${s.key}`);

          if (reason) {
            return (
              <Tooltip key={s.key}>
                <TooltipTrigger asChild>
                  <Link
                    to="/clients/$clientId/setup"
                    params={{ clientId }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground/50 hover:text-muted-foreground/80"
                  >
                    <Icon className="w-4 h-4 shrink-0" /> {s.label}
                    <Lock className="w-3 h-3 ml-auto shrink-0" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{reason}</TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Link
              key={s.key}
              to={ROUTES[s.key] as any}
              params={{ clientId } as any}
              className={itemClass(isActive)}
            >
              <Icon className="w-4 h-4 shrink-0" /> {s.label}
              {s.key === "plan" && reviewCount > 0 && (
                <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                  {reviewCount}
                </Badge>
              )}
              {s.key === "bandeja" && staleOutcomes > 0 && (
                <Badge variant="destructive" className="ml-auto h-5 px-1.5 text-[10px]">
                  {staleOutcomes}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
