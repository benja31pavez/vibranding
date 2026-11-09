import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  FileText,
  ListChecks,
  PenLine,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import {
  EmptyState,
  ErrorState,
  FitPage,
  ListSkeleton,
  Money,
  PageHeader,
  Panel,
  SectionTabs,
  StatusBadge,
  type SectionTab,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { ContractsPage } from "@/components/pages/ContractsPage";
import { formatDate } from "@/components/clients/ficha/fichaQueries";
import {
  buildContractClauses,
  CLAUSE_DEFAULTS,
  CLAUSE_TITLES,
  type ClauseKey,
} from "@/lib/contracts/clauseDefaults";
import { AGENCY_DEFAULTS } from "@/lib/pricing/plans";
import { contractSummaryLabel, type ContractServiceLine } from "./contractModel";
import {
  useContractIntake,
  useContractPricing,
  useLegalContracts,
  useSetContractStatus,
  type ContractIntake,
  type LegalContract,
} from "./legalData";

export type LegalTab = "resumen" | "documentos" | "firmas" | "plantillas";
export const LEGAL_TABS: readonly LegalTab[] = ["resumen", "documentos", "firmas", "plantillas"];
export function isLegalTab(v: unknown): v is LegalTab {
  return typeof v === "string" && (LEGAL_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<LegalTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "documentos", label: "Documentos" },
  { key: "firmas", label: "Firmas" },
  { key: "plantillas", label: "Plantillas" },
];

const DESCRIPTION: Readonly<Record<LegalTab, string>> = {
  resumen: "Estado del contrato, datos del cliente para contratar y lo que falta",
  documentos:
    "Contratos generados en la plataforma, con su estado y PDF. Los anexos aún no se guardan aquí.",
  firmas: "Contratos enviados que esperan firma y el historial de los firmados",
  plantillas: "Cláusulas y datos de la agencia que entran a cada contrato nuevo (solo lectura)",
};

interface LegalPageProps {
  clientId: string;
  tab: LegalTab;
  onTabChange: (tab: LegalTab) => void;
}

/**
 * Pantalla "Legal" del cliente con cuatro subsecciones: Resumen (contrato,
 * datos legales del cliente y pendientes), Documentos (crear contrato e
 * historial), Firmas (pendientes de firma e historial) y Plantillas (cláusulas
 * y configuración de Precios, solo lectura).
 */
export function LegalPage({ clientId, tab, onTabChange }: LegalPageProps) {
  const contracts = useLegalContracts(clientId);
  const pendingSignatures = (contracts.data ?? []).filter((c) => c.status === "sent").length;
  const tabs: readonly SectionTab<LegalTab>[] = TABS.map((t) =>
    t.key === "firmas" ? { ...t, badge: pendingSignatures } : t,
  );

  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader size="compact" title="Legal" description={DESCRIPTION[tab]} />
      <SectionTabs tabs={tabs} value={tab} onChange={onTabChange} label="Vistas de Legal" />
    </div>
  );

  if (tab === "documentos") {
    return (
      <FitPage header={header} scroll contentClassName="flex flex-col gap-4">
        <ContractsPage clientId={clientId} />
      </FitPage>
    );
  }

  if (tab === "firmas") {
    return (
      <FitPage header={header} scroll contentClassName="flex flex-col gap-4">
        <SignaturesView clientId={clientId} />
      </FitPage>
    );
  }

  if (tab === "plantillas") {
    return (
      <FitPage header={header} scroll contentClassName="flex flex-col gap-4">
        <TemplatesView />
      </FitPage>
    );
  }

  return (
    <FitPage header={header} scroll contentClassName="flex flex-col gap-4">
      <SummaryView clientId={clientId} />
    </FitPage>
  );
}

// ------------------------------------------------------------------ Resumen

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

function TabLink({ clientId, tab, label }: { clientId: string; tab: LegalTab; label: string }) {
  return (
    <Link
      to="/clients/$clientId/legal"
      params={{ clientId }}
      search={{ tab }}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {label} <ArrowRight aria-hidden className="h-3 w-3" />
    </Link>
  );
}

function services(c: LegalContract): ContractServiceLine[] {
  return Array.isArray(c.services_snapshot) ? (c.services_snapshot as ContractServiceLine[]) : [];
}

/** El contrato que manda: el firmado más reciente; si no hay, el más reciente de todos. */
function currentContract(list: readonly LegalContract[]): LegalContract | null {
  return list.find((c) => c.status === "signed") ?? list[0] ?? null;
}

interface Pending {
  key: string;
  text: string;
  tab: LegalTab | "configuracion";
}

function computePending(
  contracts: readonly LegalContract[],
  intake: ContractIntake | null,
): Pending[] {
  const out: Pending[] = [];
  const current = currentContract(contracts);
  if (!current) out.push({ key: "crear", text: "Crear el primer contrato", tab: "documentos" });
  else if (current.status === "draft")
    out.push({ key: "enviar", text: "Enviar el contrato al cliente", tab: "documentos" });
  else if (current.status === "sent")
    out.push({ key: "firma", text: "Falta la firma del cliente", tab: "firmas" });
  else if (current.status === "cancelled")
    out.push({
      key: "nuevo",
      text: "El último contrato está cancelado: crear uno nuevo",
      tab: "documentos",
    });
  if (!intake)
    out.push({
      key: "intake",
      text: "El cliente aún no envía la ficha de onboarding",
      tab: "configuracion",
    });
  else {
    if (!intake.razon_social?.trim())
      out.push({ key: "razon", text: "Falta la razón social", tab: "configuracion" });
    if (!intake.rut?.trim()) out.push({ key: "rut", text: "Falta el RUT", tab: "configuracion" });
    if (!intake.direccion?.trim())
      out.push({ key: "dir", text: "Falta la dirección", tab: "configuracion" });
  }
  return out;
}

function SummaryView({ clientId }: { clientId: string }) {
  const contracts = useLegalContracts(clientId);
  const intake = useContractIntake(clientId);
  const list = useMemo(() => contracts.data ?? [], [contracts.data]);
  const current = currentContract(list);
  const pending = useMemo(
    () => (contracts.data && !intake.isPending ? computePending(list, intake.data ?? null) : []),
    [contracts.data, intake.isPending, intake.data, list],
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Panel
        title="Contrato"
        icon={FileSignature}
        description="El firmado más reciente o, si no hay, el último creado."
        actions={<TabLink clientId={clientId} tab="documentos" label="Ver todos" />}
      >
        {contracts.isPending ? (
          <ListSkeleton rows={4} label="Cargando contrato" />
        ) : contracts.error ? (
          <ErrorState
            message={contracts.error.message}
            onRetry={() => void contracts.refetch()}
            retrying={contracts.isFetching}
          />
        ) : !current ? (
          <EmptyState
            size="compact"
            icon={FileText}
            title="Sin contrato"
            description="Genera el primero en Documentos: toma el plan, los adicionales y los datos del cliente."
            action={<TabLink clientId={clientId} tab="documentos" label="Crear contrato" />}
          />
        ) : (
          <dl className="flex flex-col">
            <Row label="Estado">
              <StatusBadge status={current.status} />
            </Row>
            <Row label="Servicios">{contractSummaryLabel(services(current))}</Row>
            {current.total_monthly > 0 && (
              <Row label="Mensual con IVA">
                <Money amount={current.total_monthly} currency={current.currency} />
              </Row>
            )}
            {current.total_one_time > 0 && (
              <Row label="Pago único con IVA">
                <Money amount={current.total_one_time} currency={current.currency} />
              </Row>
            )}
            <Row label="Vigencia desde">{formatDate(current.effective_date)}</Row>
            <Row label="Firmado">
              {current.signed_at ? formatDate(current.signed_at) : "Sin firma"}
            </Row>
            <Row label="Contratos en total">{list.length}</Row>
          </dl>
        )}
      </Panel>

      <Panel
        title="Datos para contratos"
        icon={Building2}
        description="Los envía el cliente en la ficha de onboarding y se copian a cada contrato."
        actions={
          <Link
            to="/clients/$clientId"
            params={{ clientId }}
            search={{ tab: "configuracion" }}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Ver ficha <ArrowRight aria-hidden className="h-3 w-3" />
          </Link>
        }
      >
        {intake.isPending ? (
          <ListSkeleton rows={4} label="Cargando datos del cliente" />
        ) : intake.error ? (
          <ErrorState
            message={intake.error.message}
            onRetry={() => void intake.refetch()}
            retrying={intake.isFetching}
          />
        ) : !intake.data ? (
          <EmptyState
            size="compact"
            icon={ClipboardList}
            title="Sin ficha de onboarding"
            description="Cuando el cliente complete el formulario de onboarding verás aquí su razón social, RUT y dirección."
          />
        ) : (
          <dl className="flex flex-col">
            <Row label="Razón social">{intake.data.razon_social?.trim() || "—"}</Row>
            <Row label="RUT">{intake.data.rut?.trim() || "—"}</Row>
            <Row label="Dirección">{intake.data.direccion?.trim() || "—"}</Row>
            <Row label="Correo de facturación">
              {intake.data.email_facturacion?.trim() || intake.data.contacto_email?.trim() || "—"}
            </Row>
            <Row label="Contacto">{intake.data.contacto_nombre?.trim() || "—"}</Row>
            <Row label="Ficha enviada">{formatDate(intake.data.submitted_at)}</Row>
          </dl>
        )}
      </Panel>

      <Panel
        title="Pendientes"
        icon={ListChecks}
        description="Lo que falta para tener el contrato al día."
      >
        {contracts.isPending || intake.isPending ? (
          <ListSkeleton rows={3} label="Revisando pendientes" />
        ) : contracts.error || intake.error ? (
          <p className="text-sm text-muted-foreground">
            No pudimos calcular los pendientes; revisa los otros paneles.
          </p>
        ) : pending.length === 0 ? (
          <EmptyState
            size="compact"
            icon={CheckCircle2}
            title="Todo al día"
            description="Hay contrato firmado y los datos del cliente están completos."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((p) => (
              <li key={p.key} className="flex items-start justify-between gap-3 text-sm">
                <span>{p.text}</span>
                {p.tab === "configuracion" ? (
                  <Link
                    to="/clients/$clientId"
                    params={{ clientId }}
                    search={{ tab: "configuracion" }}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    Ficha
                  </Link>
                ) : (
                  <TabLink clientId={clientId} tab={p.tab} label="Ir" />
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------------- Firmas

function SignaturesView({ clientId }: { clientId: string }) {
  const contracts = useLegalContracts(clientId);
  const setStatus = useSetContractStatus(clientId);
  const [busy, setBusy] = useState<string | null>(null);
  const list = contracts.data ?? [];
  const pending = list.filter((c) => c.status === "sent");
  const signed = list
    .filter((c) => c.status === "signed")
    .sort((a, b) => (b.signed_at ?? b.updated_at).localeCompare(a.signed_at ?? a.updated_at));

  const markSigned = async (c: LegalContract) => {
    setBusy(c.id);
    const ok = await setStatus(c.id, "signed");
    setBusy(null);
    if (ok) toast.success("Contrato marcado como firmado");
  };

  if (contracts.isPending) return <ListSkeleton rows={4} label="Cargando firmas" />;
  if (contracts.error) {
    return (
      <ErrorState
        title="No pudimos cargar los contratos"
        message={contracts.error.message}
        onRetry={() => void contracts.refetch()}
        retrying={contracts.isFetching}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Panel
        title="Pendientes de firma"
        icon={PenLine}
        description="Contratos en estado «Enviado». La firma se registra a mano cuando el cliente devuelve el PDF firmado."
      >
        {pending.length === 0 ? (
          <EmptyState
            size="compact"
            icon={PenLine}
            title="Nada pendiente de firma"
            description={
              list.length === 0
                ? "Crea un contrato en Documentos y márcalo como «Enviado» cuando lo mandes."
                : "Cuando marques un contrato como «Enviado» aparecerá aquí hasta que se firme."
            }
            action={<TabLink clientId={clientId} tab="documentos" label="Ir a Documentos" />}
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {pending.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {contractSummaryLabel(services(c))}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Enviado · última actualización {formatDate(c.updated_at)} · creado{" "}
                    {formatDate(c.created_at)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === c.id}
                  onClick={() => void markSigned(c)}
                >
                  {busy === c.id ? "Guardando…" : "Marcar firmado"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Historial de firmas"
        icon={CheckCircle2}
        description="Contratos firmados, con la fecha en que se registró la firma."
      >
        {signed.length === 0 ? (
          <EmptyState
            size="compact"
            icon={FileSignature}
            title="Aún no hay contratos firmados"
            description="Cuando un contrato pase a «Firmado» quedará aquí con su fecha."
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {signed.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {contractSummaryLabel(services(c))}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Firmado el {c.signed_at ? formatDate(c.signed_at) : "— (sin fecha registrada)"}{" "}
                    · vigencia desde {formatDate(c.effective_date)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <p className="text-xs text-muted-foreground md:col-span-2">
        La plataforma no tiene firma electrónica: los estados «Enviado» y «Firmado» se marcan a mano
        y solo la firma guarda fecha.
      </p>
    </div>
  );
}

// --------------------------------------------------------------- Plantillas

const CLAUSE_KEYS: readonly ClauseKey[] = [
  "clause_esim",
  "clause_meta_api",
  "clause_late_payment",
  "clause_extra",
];

function TemplatesView() {
  const pricing = useContractPricing();

  if (pricing.isPending) return <ListSkeleton rows={4} label="Cargando plantillas" />;
  if (pricing.error) {
    return (
      <ErrorState
        title="No pudimos cargar la configuración de Precios"
        message={pricing.error.message}
        onRetry={() => void pricing.refetch()}
        retrying={pricing.isFetching}
      />
    );
  }

  const p = pricing.data;
  const clauses = buildContractClauses(p ?? {});
  const editLink = (
    <Link
      to="/settings/pricing"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      Editar en Precios <ArrowRight aria-hidden className="h-3 w-3" />
    </Link>
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="min-w-0 md:col-span-2">
        <Panel
          title="Cláusulas del contrato"
          icon={FileText}
          description="Entran en este orden a cada contrato nuevo. Una cláusula vacía en Precios usa el texto por defecto."
          actions={editLink}
        >
          <ul className="flex flex-col gap-4">
            {CLAUSE_KEYS.map((key) => {
              const saved = p?.[key];
              const body = (saved ?? CLAUSE_DEFAULTS[key]).trim();
              const custom = saved !== null && saved !== undefined && saved.trim() !== "";
              if (!body) {
                return (
                  <li key={key}>
                    <p className="text-sm font-medium">{CLAUSE_TITLES[key]}</p>
                    <p className="text-xs text-muted-foreground">
                      Sin texto: no entra al contrato. Agrégala en Precios si la necesitas.
                    </p>
                  </li>
                );
              }
              return (
                <li key={key}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{CLAUSE_TITLES[key]}</p>
                    <StatusBadge
                      status={custom ? "custom" : "default"}
                      label={custom ? "Personalizada" : "Texto por defecto"}
                      tone={custom ? "info" : "neutral"}
                    />
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            {clauses.length} {clauses.length === 1 ? "cláusula entra" : "cláusulas entran"} hoy al
            contrato.
          </p>
        </Panel>
      </div>

      <Panel
        title="Datos de la agencia"
        icon={Settings2}
        description="Configuración de Precios que se copia al contrato (solo lectura)."
        actions={editLink}
      >
        <dl className="flex flex-col">
          <Row label="Nombre comercial">{AGENCY_DEFAULTS.name}</Row>
          <Row label="Razón social">{p?.agency_legal_name || AGENCY_DEFAULTS.legal_name}</Row>
          <Row label="RUT">{p?.agency_tax_id || AGENCY_DEFAULTS.tax_id}</Row>
          <Row label="Dirección">{p?.agency_address || AGENCY_DEFAULTS.address}</Row>
          <Row label="Correo">{p?.agency_email || AGENCY_DEFAULTS.email || "—"}</Row>
          <Row label="Jurisdicción">{p?.jurisdiction || AGENCY_DEFAULTS.jurisdiction}</Row>
          <Row label="Plazo de pago">
            {p ? `${p.payment_due_days} ${p.payment_due_days === 1 ? "día" : "días"}` : "—"}
          </Row>
          <Row label="Moneda">{p?.currency ?? "CLP"}</Row>
        </dl>
      </Panel>
    </div>
  );
}
