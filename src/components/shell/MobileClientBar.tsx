import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useClientCapabilities } from "@/hooks/use-client-capabilities";
import { CLIENT_SECTIONS } from "@/lib/clientSections";
import { cn } from "@/lib/utils";
import { ClientSwitcher } from "./ClientSwitcher";
import type { ClientSummary } from "./useClientList";

interface MobileClientBarProps {
  path: string;
  activeClient: ClientSummary | null;
}

/**
 * En teléfono (bajo md), el menú lateral del cliente se convierte en una franja índigo
 * bajo la cabecera: selector de cliente (abre el pop-up "Cambiar de cliente") y las
 * secciones como chips deslizables. Solo aparece dentro de las pantallas de un cliente.
 */
export function MobileClientBar({ path, activeClient }: MobileClientBarProps) {
  const clientId = activeClient?.id ?? null;
  const inClient = Boolean(clientId && path.startsWith(`/clients/${clientId}`));
  const { caps, error: capsError } = useClientCapabilities(inClient ? clientId : null);
  if (!activeClient || !clientId || !inClient) return null;

  const base = `/clients/${clientId}`;
  const onPanel = [base, `${base}/`, `${base}/ficha`, `${base}/ficha/`].includes(path);

  return (
    <div className="shell-sidebar-indigo md:hidden">
      <div className="px-3 pb-2 pt-2">
        <ClientSwitcher activeClient={activeClient} />
      </div>
      <nav
        aria-label="Secciones del cliente"
        className="flex gap-2 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Orden lineal de los chips: Panel abre el grupo PRINCIPAL; el resto sigue el orden
            declarado en CLIENT_SECTIONS (PRINCIPAL → DIFUSIÓN → NEGOCIO). */}
        <Chip to="/clients/$clientId" params={{ clientId }} active={onPanel}>
          Panel
        </Chip>
        {CLIENT_SECTIONS.map((s) => {
          const href = `${base}/${s.key}`;
          const active =
            path === href || path.startsWith(`${href}/`) || path.startsWith(`${href}?`);
          const locked = capsError ? null : s.lockedReason(caps);
          return (
            <Chip
              key={s.key}
              to={`/clients/$clientId/${s.key}`}
              params={{ clientId }}
              active={active}
              locked={Boolean(locked)}
              title={locked ?? undefined}
            >
              {s.label}
            </Chip>
          );
        })}
      </nav>
    </div>
  );
}

function Chip({
  to,
  params,
  active,
  locked,
  title,
  children,
}: {
  to: string;
  params: Record<string, string>;
  active: boolean;
  locked?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      params={params}
      title={title}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fb2ff]",
        active
          ? "bg-[#2F6BFF] text-white"
          : locked
            ? "bg-[#1C1F47] text-[#7E82A6]"
            : "bg-[#1C1F47] text-[#C9CBE0]",
      )}
    >
      {children}
      {locked && <Lock className="h-3 w-3" aria-hidden="true" />}
      {locked && <span className="sr-only">(bloqueada)</span>}
    </Link>
  );
}
