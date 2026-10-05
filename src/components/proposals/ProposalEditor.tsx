import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLANS, findPlan, formatMoney, planPriceLabel, type PlanKey } from "@/lib/pricing/plans";
import {
  DEFAULT_VALIDITY_DAYS,
  PROPOSAL_STATUS_META,
  chileDatePlusDays,
  computeTotals,
  endOfChileDayIso,
  formatChileDate,
  parseItems,
  isStalePlanItem,
  planItem,
  proposalConditions,
  toChileDate,
  validateDraft,
  type ProposalItem,
  type ProposalStatus,
} from "@/lib/proposals/model";
import {
  buildProposalIntro,
  readDiagnosticoSignals,
  recommendPlan,
  type DiagnosticoSignals,
  type PlanRecommendation,
} from "@/lib/proposals/recommend";
import { ExtraItemsEditor, toExtraRow, type ExtraRow } from "./ExtraItemsEditor";
import { ProposalLines } from "./ProposalLines";
import { ProposalIntroPanel } from "./ProposalIntroPanel";
import { ProposalLinkActions } from "./ProposalLinkActions";
import { ProposalStatusBadge } from "./ProposalsPanel";
import { OpenProposalWarning } from "./OpenProposalWarning";
import { useSaveProposal, type ProposalRow, type Recipient } from "./proposalQueries";

const NO_PLAN = "none";
/** Estados que se eligen a mano. "vista" y "aceptada" los pone el sistema. */
const MANUAL_STATUSES: readonly ProposalStatus[] = ["borrador", "enviada", "rechazada", "expirada"];

interface Props {
  recipient: Recipient;
  existing?: ProposalRow;
  canEdit: boolean;
}

/** Señales del diagnóstico y plan recomendado (solo prospectos). */
function prospectInsights(
  recipient: Recipient,
): { signals: DiagnosticoSignals; recommendation: PlanRecommendation } | null {
  if (recipient.kind !== "prospect" || !recipient.prospect) return null;
  const signals = readDiagnosticoSignals(recipient.prospect.notas);
  return {
    signals,
    recommendation: recommendPlan({
      productoSugerido: recipient.prospect.productoSugerido,
      signals,
      wasClient: recipient.prospect.wasClient,
    }),
  };
}

function initialState(
  recipient: Recipient,
  existing: ProposalRow | undefined,
  recommended: PlanKey | null,
) {
  const items = parseItems(existing?.items ?? []);
  const plan = items.find((i) => i.type === "plan");
  // Propuesta nueva para un prospecto: parte con el plan recomendado.
  const startPlan = existing ? (plan?.key ?? existing.plan_key) : recommended;
  return {
    title: existing?.title ?? `Propuesta para ${recipient.name}`,
    planKey: (startPlan ?? NO_PLAN) as PlanKey | typeof NO_PLAN,
    extras: items.filter((i) => i.type === "extra").map(toExtraRow),
    // Línea del plan tal como se guardó: no se re-precia sola (propuestas con precio anterior).
    savedPlanItem: plan ?? null,
    expiresDate: existing
      ? toChileDate(existing.expires_at)
      : chileDatePlusDays(DEFAULT_VALIDITY_DAYS),
    status: (existing?.status ?? "borrador") as string,
  };
}

function buildItems(
  planKey: string,
  extras: readonly ExtraRow[],
  savedPlanItem: ProposalItem | null,
): ProposalItem[] {
  const plan = findPlan(planKey);
  const extraItems = extras.map(({ item }) => ({ ...item, label: item.label.trim() }));
  if (!plan) return extraItems;
  const planLine = savedPlanItem?.key === plan.key ? savedPlanItem : planItem(plan.key);
  return [planLine, ...extraItems];
}

/** Editor de propuesta: título, plan + adicionales, vencimiento y estado. */
export function ProposalEditor({ recipient, existing, canEdit }: Props) {
  const navigate = useNavigate();
  const save = useSaveProposal();
  const insights = useMemo(() => prospectInsights(recipient), [recipient]);
  const [state, setState] = useState(() =>
    initialState(recipient, existing, insights?.recommendation.planKey ?? null),
  );
  // Una propuesta nueva ya creada queda bloqueada mientras se navega a su página (evita duplicados).
  const locked = !canEdit || existing?.status === "aceptada" || (!existing && save.isSuccess);

  const items = useMemo(
    () => buildItems(state.planKey, state.extras, state.savedPlanItem),
    [state.planKey, state.extras, state.savedPlanItem],
  );
  const stalePlanItem = items.find(isStalePlanItem) ?? null;
  const totals = computeTotals(items);
  const errors = validateDraft({ title: state.title, items });
  const statusOptions = MANUAL_STATUSES.includes(state.status as ProposalStatus)
    ? MANUAL_STATUSES
    : [...MANUAL_STATUSES, state.status as ProposalStatus];

  const set = <K extends keyof typeof state>(key: K, value: (typeof state)[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (locked || save.isPending || save.isSuccess) return;
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    let expiresAt: string | null = null;
    try {
      expiresAt = state.expiresDate ? endOfChileDayIso(state.expiresDate) : null;
    } catch {
      toast.error("La fecha de vencimiento no es válida.");
      return;
    }
    const draft = {
      title: state.title,
      planKey: findPlan(state.planKey)?.key ?? null,
      items,
      amountClp: totals.firstCharge,
      expiresAt,
      status: state.status,
    };
    save.mutate(
      { recipient, draft, existing },
      {
        onSuccess: ({ id, prospectStage }) => {
          toast.success(existing ? "Propuesta guardada" : "Propuesta creada");
          if (prospectStage === "advanced")
            toast.success(`${recipient.name} pasó a la etapa Propuesta`);
          if (prospectStage === "failed")
            toast.warning("No se pudo mover el prospecto a Propuesta; cámbialo a mano.");
          if (!existing)
            void navigate({
              to: "/proposals/$proposalId",
              params: { proposalId: id },
              replace: true,
            });
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const selectedPlan = findPlan(state.planKey);
  const intro = insights
    ? buildProposalIntro({
        nombre: recipient.name,
        rubro: recipient.prospect?.rubro,
        comuna: recipient.prospect?.comuna,
        objetivo: insights.signals.objetivo,
        planKey: selectedPlan?.key ?? null,
      })
    : null;
  const recommendedPlan = findPlan(insights?.recommendation.planKey);

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        {locked && existing?.status === "aceptada" && (
          <p className="flex items-center gap-2 rounded-app-md bg-success-subtle px-3 py-2 text-sm text-success-strong">
            <Lock aria-hidden className="h-4 w-4" /> Propuesta aceptada: ya no se puede editar.
          </p>
        )}
        {!existing && <OpenProposalWarning recipient={recipient} />}
        <Panel title="Datos">
          <fieldset disabled={locked} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="proposal-title">Título</Label>
              <Input
                id="proposal-title"
                value={state.title}
                maxLength={140}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proposal-expires">Vence el</Label>
                <Input
                  id="proposal-expires"
                  type="date"
                  value={state.expiresDate}
                  onChange={(e) => set("expiresDate", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Por defecto {DEFAULT_VALIDITY_DAYS} días. Hora de Chile.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proposal-status">Estado</Label>
                <Select
                  value={state.status}
                  onValueChange={(v) => set("status", v)}
                  disabled={locked}
                >
                  <SelectTrigger id="proposal-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s} disabled={!MANUAL_STATUSES.includes(s)}>
                        {PROPOSAL_STATUS_META[s]?.label ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  El link público funciona desde "Enviada".
                </p>
              </div>
            </div>
          </fieldset>
        </Panel>

        <Panel
          title="Plan"
          description="Precios netos + IVA 19% (src/lib/pricing/plans.ts). El cliente paga el total con IVA."
        >
          <Select
            value={state.planKey}
            onValueChange={(v) => set("planKey", v as PlanKey)}
            disabled={locked}
          >
            <SelectTrigger aria-label="Plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PLAN}>Sin plan (solo ítems a medida)</SelectItem>
              {PLANS.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label} · {planPriceLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPlan && (
            <p className="mt-2 text-sm text-muted-foreground">{selectedPlan.description}</p>
          )}
          {selectedPlan?.returningClientsOnly && (
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedPlan.note} No aparece en el sitio público.
            </p>
          )}
          {stalePlanItem && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-app-md bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
              <span>
                {`Esta propuesta tiene el precio anterior del plan (${formatMoney(stalePlanItem.amount)} a pagar, con IVA). Se mantiene tal cual mientras no lo actualices.`}
              </span>
              {!locked && state.status === "borrador" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => set("savedPlanItem", null)}
                >
                  Usar precio vigente
                </Button>
              )}
            </div>
          )}
          {insights && !existing && (
            <p className="mt-2 text-xs text-muted-foreground">
              {recommendedPlan ? `Recomendado: ${recommendedPlan.label}. ` : ""}
              {insights.recommendation.reason}
            </p>
          )}
        </Panel>

        {intro !== null && (
          <ProposalIntroPanel
            generated={intro}
            linkToken={existing?.token ?? null}
            linkIsDraft={existing?.status === "borrador"}
          />
        )}

        <Panel title="Adicionales y descuentos">
          <ExtraItemsEditor
            items={state.extras}
            onChange={(rows) => set("extras", rows)}
            disabled={locked}
          />
        </Panel>

        {!locked && (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={save.isPending || errors.length > 0}>
              <Save aria-hidden className="mr-1.5 h-4 w-4" />{" "}
              {existing ? "Guardar cambios" : "Crear propuesta"}
            </Button>
            {errors.length > 0 && <p className="text-sm text-muted-foreground">{errors[0]}</p>}
          </div>
        )}
      </div>

      <aside className="space-y-6 lg:col-span-2" aria-label="Resumen de la propuesta">
        <Panel
          title="Resumen"
          actions={
            existing ? (
              <ProposalStatusBadge status={existing.status} expiresAt={existing.expires_at} />
            ) : undefined
          }
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Para <span className="font-medium text-foreground">{recipient.name}</span>
            {recipient.kind === "prospect" ? " (prospecto)" : ""}
            {recipient.prospect?.email && (
              <>
                <br />
                <a
                  href={`mailto:${encodeURIComponent(recipient.prospect.email)}`}
                  className="text-xs hover:underline"
                >
                  {recipient.prospect.email}
                </a>
              </>
            )}
          </p>
          {items.length > 0 ? (
            <ProposalLines items={items} />
          ) : (
            <p className="text-sm text-muted-foreground">Elige un plan o agrega ítems.</p>
          )}
          {existing && (
            <div className="mt-4 space-y-2 border-t border-border-subtle pt-4">
              <ProposalLinkActions proposal={existing} showOpen />
              {existing.accepted_at && (
                <p className="text-xs text-muted-foreground">
                  Aceptada el {formatChileDate(existing.accepted_at)} por {existing.accepted_name}.
                </p>
              )}
            </div>
          )}
        </Panel>
        <Panel title="Condiciones que verá el cliente">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            {proposalConditions(findPlan(state.planKey)?.key ?? null, items).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </Panel>
      </aside>
    </form>
  );
}
