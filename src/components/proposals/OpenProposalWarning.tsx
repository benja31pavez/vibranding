import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { PROPOSAL_STATUS_META, effectiveStatus, formatChileDate, isProposalStatus } from "@/lib/proposals/model";
import { useRecipientProposals, type Recipient } from "./proposalQueries";

/** Estados en los que una propuesta sigue abierta (sin contar las vencidas). */
const OPEN_STATUSES = ["borrador", "enviada", "vista"] as const;

/** Aviso en una propuesta nueva si el destinatario ya tiene otra abierta (evita duplicar). */
export function OpenProposalWarning({ recipient }: { recipient: Pick<Recipient, "kind" | "id"> }) {
  const query = useRecipientProposals({ kind: recipient.kind, id: recipient.id });
  const open = (query.data ?? []).find((p) =>
    (OPEN_STATUSES as readonly string[]).includes(effectiveStatus(p.status, p.expires_at)),
  );
  if (!open) return null;
  return (
    <div
      role="status"
      className="flex gap-2 rounded-app-md border border-warning/40 bg-warning-subtle p-3 text-sm text-warning-strong"
    >
      <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Ya tiene una propuesta abierta ({isProposalStatus(open.status) ? PROPOSAL_STATUS_META[open.status].label.toLowerCase() : open.status}, creada el {formatChileDate(open.created_at)}).{" "}
        <Link to="/proposals/$proposalId" params={{ proposalId: open.id }} className="font-medium underline">
          Abrir “{open.title || "Propuesta sin título"}”
        </Link>{" "}
        antes de crear otra.
      </p>
    </div>
  );
}
