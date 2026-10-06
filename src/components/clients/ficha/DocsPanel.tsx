import { useState, type ComponentType, type ReactNode } from "react";
import {
  Building2,
  ClipboardList,
  FileBarChart,
  FileSignature,
  FileText,
  FolderOpen,
  Link2,
  Star,
  Users,
} from "lucide-react";
import { FitList, TONE_CLASSES, type StatusTone } from "@/components/app";
import { Button } from "@/components/ui/button";
import {
  CLIENT_ACCESS_INFO,
  ClientAccessCard,
  useClientAccess,
} from "@/components/clients/ClientAccessCard";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { ProposalsPanel } from "@/components/proposals/ProposalsPanel";
import { useRecipientProposals } from "@/components/proposals/proposalQueries";
import { useClientReports } from "@/components/reports/reportQueries";
import { RequestReviewPanel } from "@/components/reviews/RequestReviewPanel";
import { periodLabel } from "@/lib/billing/dates";
import { cn } from "@/lib/utils";
import { BusinessDescription } from "./BusinessDescriptionPanel";
import { ContractPanel, useLatestContract } from "./ContractPanel";
import { FichaCard } from "./FichaCard";
import { FichaSheet } from "./FichaSheet";
import { formatDate, useUserKey, type FichaOverview } from "./fichaQueries";
import { OnboardingIntakePanel, useClientIntake } from "./OnboardingIntakePanel";
import { OnboardingLinkPanel, currentOnboardingLink } from "./OnboardingLinkPanel";
import { ReportsPanel } from "./ReportsPanel";

const REVIEWS_INFO =
  "Las reseñas en Google y los testimonios de clientes ayudan a cerrar nuevos clientes.";
const REPORTS_INFO = "Se generan solos el día 1 de cada mes con los resultados del mes anterior.";
const ONBOARDING_INFO = "Datos que el cliente completa en su link de onboarding.";
const ONBOARDING_LINK_INFO =
  "Compártelo con el cliente para que complete sus datos, redes y archivos. Sirve para un solo envío.";
const MOBILE_PAGE_SIZE = 8;

const CONTRACT_STATUS: Readonly<Record<string, { label: string; tone: StatusTone }>> = {
  signed: { label: "Firmado", tone: "success" },
  sent: { label: "Enviado, sin firmar", tone: "warning" },
  draft: { label: "Borrador", tone: "neutral" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

interface DocItem {
  id: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  status: string;
  tone: StatusTone;
  action: string;
  info?: ReactNode;
  wide?: boolean;
  content: ReactNode;
}

function DocRow({ item, onOpen }: { item: DocItem; onOpen: () => void }) {
  const Icon = item.icon;
  return (
    <div className="flex min-w-0 items-center gap-3 py-1.5">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-app-md bg-surface-2">
        <Icon aria-hidden className="h-4 w-4 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_CLASSES[item.tone].dot)}
          />
          <span className="truncate">{item.status}</span>
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 px-2 text-xs"
        aria-haspopup="dialog"
        aria-label={`${item.action}: ${item.title}`}
        onClick={onOpen}
      >
        {item.action}
      </Button>
    </div>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function useDocItems(clientId: string, overview: FichaOverview | undefined): DocItem[] {
  const { client, reloadClient } = useActiveClient();
  const userKey = useUserKey();
  const canEdit = Boolean(overview?.canEdit);
  const clientName = client?.name ?? "";
  const contract = useLatestContract(clientId);
  const proposals = useRecipientProposals({ kind: "client", id: clientId });
  const reports = useClientReports(userKey, clientId);
  const access = useClientAccess(clientId);
  const intake = useClientIntake(clientId, canEdit);

  const contractMeta = contract.data ? CONTRACT_STATUS[contract.data.status] : undefined;
  const proposalCount = proposals.data?.length ?? 0;
  const accepted = proposals.data?.filter((p) => p.accepted_at).length ?? 0;
  const latestReport = reports.data?.[0];
  const people = access.data?.length ?? 0;
  const link = overview ? currentOnboardingLink(overview) : null;
  const about = client?.business_description?.trim() ?? "";

  const items: DocItem[] = [
    {
      id: "contract",
      icon: FileSignature,
      title: "Contrato",
      status: contract.isLoading
        ? "Cargando…"
        : (contractMeta?.label ?? (contract.data ? contract.data.status : "Sin contrato")),
      tone: contractMeta?.tone ?? "warning",
      action: contract.data ? "Ver" : "Crear",
      content: <ContractPanel clientId={clientId} />,
    },
    {
      id: "proposals",
      icon: FileText,
      title: "Propuestas",
      status: proposals.isLoading
        ? "Cargando…"
        : proposalCount === 0
          ? "Sin propuestas"
          : `${plural(proposalCount, "propuesta", "propuestas")}${accepted ? ` · ${accepted} aceptada${accepted === 1 ? "" : "s"}` : ""}`,
      tone: accepted > 0 ? "success" : proposalCount > 0 ? "info" : "neutral",
      action: "Ver",
      wide: true,
      content: <ProposalsPanel clientId={clientId} canEdit={canEdit} />,
    },
    {
      id: "reports",
      icon: FileBarChart,
      title: "Reportes",
      status: reports.isLoading
        ? "Cargando…"
        : latestReport
          ? `Último: ${periodLabel(latestReport.period)}`
          : "Sin reportes",
      tone: latestReport?.sent_at ? "success" : latestReport ? "warning" : "neutral",
      action: "Ver",
      info: REPORTS_INFO,
      wide: true,
      content: <ReportsPanel clientId={clientId} clientName={clientName} canEdit={canEdit} />,
    },
    {
      id: "access",
      icon: Users,
      title: "Acceso del cliente",
      status: access.isLoading
        ? "Cargando…"
        : people
          ? plural(people, "persona", "personas")
          : "Sin acceso al portal",
      tone: people ? "success" : "warning",
      action: "Invitar",
      info: CLIENT_ACCESS_INFO,
      content: <ClientAccessCard clientId={clientId} />,
    },
  ];
  if (overview) {
    items.push(
      {
        id: "onboardingLink",
        icon: Link2,
        title: "Link de onboarding",
        status: link ? `Vence el ${formatDate(link.expiresAt)}` : "Sin link vigente",
        tone: link ? "success" : "neutral",
        action: link ? "Copiar" : "Generar",
        info: ONBOARDING_LINK_INFO,
        content: <OnboardingLinkPanel clientId={clientId} overview={overview} />,
      },
      {
        id: "onboarding",
        icon: ClipboardList,
        title: "Onboarding",
        status: !canEdit
          ? "Solo editores"
          : intake.data
            ? `Recibido el ${formatDate(intake.data.submitted_at)}`
            : intake.isLoading
              ? "Cargando…"
              : "Pendiente",
        tone: intake.data ? "success" : canEdit ? "warning" : "neutral",
        action: "Ver",
        info: ONBOARDING_INFO,
        wide: true,
        content: <OnboardingIntakePanel clientId={clientId} canEdit={canEdit} />,
      },
    );
  }
  items.push(
    {
      id: "reviews",
      icon: Star,
      title: "Reseñas y testimonios",
      status: "Reseña en Google o testimonio",
      tone: "neutral",
      action: "Pedir",
      info: REVIEWS_INFO,
      content: <RequestReviewPanel clientId={clientId} clientName={clientName} />,
    },
    {
      id: "about",
      icon: Building2,
      title: "Sobre la empresa",
      status: about || "Sin descripción",
      tone: about ? "success" : "warning",
      action: about ? "Ver" : "Agregar",
      content: (
        <BusinessDescription
          clientId={clientId}
          value={client?.business_description ?? ""}
          onSaved={reloadClient}
        />
      ),
    },
  );
  return items;
}

/** "Documentos y accesos": una fila por documento o acceso, con su estado y una acción. */
export function DocsPanel({
  clientId,
  overview,
}: {
  clientId: string;
  overview: FichaOverview | undefined;
}) {
  const items = useDocItems(clientId, overview);
  // El id se conserva al cerrar para que el panel no quede vacío durante la animación.
  const [openId, setOpenId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const open = items.find((i) => i.id === openId);

  return (
    <FichaCard title="Documentos y accesos" icon={FolderOpen} fill>
      <FitList
        items={items}
        getKey={(i) => i.id}
        label="Documentos y accesos"
        defaultPageSize={MOBILE_PAGE_SIZE}
        mobileShowAll
        renderItem={(i) => (
          <DocRow
            item={i}
            onOpen={() => {
              setOpenId(i.id);
              setSheetOpen(true);
            }}
          />
        )}
      />
      <FichaSheet
        open={sheetOpen && Boolean(open)}
        onOpenChange={setSheetOpen}
        title={open?.title ?? ""}
        info={open?.info}
        wide={open?.wide}
      >
        {open?.content}
      </FichaSheet>
    </FichaCard>
  );
}
