import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { OBJECTIVES, BID_STRATEGIES } from "@/lib/meta-ads/constants";
import type { CampaignDraft } from "@/lib/meta-ads/schemas";

type Errors = Record<string, string>;

export function Step1Campaign({
  draft, errors, onChange,
}: { draft: CampaignDraft; errors: Errors; onChange: (patch: Partial<CampaignDraft>) => void }) {
  const E = ({ k }: { k: string }) => errors[k] ? <p className="text-[11px] text-destructive">{errors[k]}</p> : null;
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Nombre de la campaña *</Label>
          <Input value={draft.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Ej. Promoción primavera 2026" />
          <E k="name" />
        </div>
        <div className="space-y-1">
          <Label>Objetivo *</Label>
          <Select value={draft.objective} onValueChange={(v) => onChange({ objective: v as CampaignDraft["objective"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(OBJECTIVES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Estado al publicar *</Label>
          <Select value={draft.status} onValueChange={(v) => onChange({ status: v as CampaignDraft["status"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PAUSED">Pausada (recomendado)</SelectItem>
              <SelectItem value="ACTIVE">Activa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Estrategia de puja *</Label>
          <Select value={draft.bidStrategy} onValueChange={(v) => onChange({ bidStrategy: v as CampaignDraft["bidStrategy"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(BID_STRATEGIES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Optimización del presupuesto (CBO)</Label>
            <p className="text-xs text-muted-foreground">Meta distribuye el presupuesto entre los conjuntos automáticamente.</p>
          </div>
          <Switch checked={draft.cboEnabled} onCheckedChange={(v) => onChange({ cboEnabled: v })} />
        </div>
        {draft.cboEnabled && (
          <div className="grid md:grid-cols-2 gap-3 pt-2 border-t">
            <div className="space-y-1">
              <Label>Tipo de presupuesto</Label>
              <Select value={draft.budgetType} onValueChange={(v) => onChange({ budgetType: v as CampaignDraft["budgetType"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="lifetime">Total</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Monto del presupuesto (CLP) *</Label>
              <Input type="number" min={1} value={draft.budgetAmount ?? ""} onChange={(e) => onChange({ budgetAmount: Number(e.target.value) })} />
              <E k="budgetAmount" />
            </div>
          </div>
        )}
        {!draft.cboEnabled && (
          <p className="text-xs text-muted-foreground pt-2 border-t">El presupuesto se define en cada conjunto de anuncios.</p>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Inicio *</Label>
          <Input type="datetime-local" value={draft.startTime} onChange={(e) => onChange({ startTime: e.target.value })} />
          <E k="startTime" />
        </div>
        <div className="space-y-1">
          <Label>Fin (opcional)</Label>
          <Input type="datetime-local" value={draft.endTime ?? ""} onChange={(e) => onChange({ endTime: e.target.value || null })} />
          <E k="endTime" />
        </div>
        <div className="space-y-1">
          <Label>Tope de gasto total (opcional)</Label>
          <Input type="number" min={0} value={draft.spendCap ?? ""} onChange={(e) => onChange({ spendCap: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </div>
    </div>
  );
}
