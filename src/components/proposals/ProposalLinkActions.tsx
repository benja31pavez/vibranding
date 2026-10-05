import { Copy, ExternalLink, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publicProposalPath } from "@/lib/proposals/model";
import { copyProposalLink, useMarkProposalSent, type ProposalRow } from "./proposalQueries";

interface Props {
  proposal: Pick<ProposalRow, "id" | "token" | "status">;
  /** Muestra "Abrir" (vista previa sin marcar "vista"). */
  showOpen?: boolean;
  size?: "sm" | "default";
}

/** Copiar link público, marcar enviada y abrir vista previa. */
export function ProposalLinkActions({ proposal, showOpen = false, size = "sm" }: Props) {
  const markSent = useMarkProposalSent();
  const isDraft = proposal.status === "borrador";

  const copy = async () => {
    const ok = await copyProposalLink(proposal.token);
    if (!ok) {
      toast.error("No se pudo copiar; ábrela y copia la dirección a mano.");
      return;
    }
    toast.success(
      isDraft
        ? "Link copiado. Funcionará cuando marques la propuesta como enviada."
        : "Link copiado",
    );
  };

  const send = () =>
    markSent.mutate(proposal.id, {
      onSuccess: () => toast.success("Propuesta marcada como enviada"),
      onError: (e) => toast.error(e.message),
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size={size} variant="outline" onClick={copy}>
        <Copy aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Copiar link
      </Button>
      {isDraft && (
        <Button
          type="button"
          size={size}
          variant="outline"
          onClick={send}
          disabled={markSent.isPending}
        >
          <Send aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Marcar enviada
        </Button>
      )}
      {showOpen && !isDraft && (
        <Button size={size} variant="ghost" asChild>
          <a
            href={`${publicProposalPath(proposal.token)}?vista=interna`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink aria-hidden className="mr-1.5 h-3.5 w-3.5" /> Abrir
          </a>
        </Button>
      )}
    </div>
  );
}
