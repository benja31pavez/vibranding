import { useApprovalCount } from "@/hooks/use-approval-queue";

const MAX_SHOWN = 99;

/** Contador de pendientes junto a "Aprobaciones". No se muestra con 0. */
function ApprovalsBadge() {
  const count = useApprovalCount();
  if (count === 0) return null;
  return (
    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold tabular-nums text-[#D6336C] shadow-sm">
      {count > MAX_SHOWN ? `${MAX_SHOWN}+` : count}
      <span className="sr-only"> pendientes</span>
    </span>
  );
}

/** Badges por ruta de la navegación principal. */
export function NavBadge({ to }: { to: string }) {
  return to === "/approvals" ? <ApprovalsBadge /> : null;
}
