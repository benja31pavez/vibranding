import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { OPTIMIZATION_GOALS, BILLING_EVENTS } from "@/lib/meta-ads/constants";
import type { AdsetDraft } from "@/lib/meta-ads/schemas";
import { TagsInput } from "./TagsInput";
import { CountriesPicker } from "./CountriesPicker";
import { PlacementsPicker } from "./PlacementsPicker";

type Errors = Record<string, string>;

export function Step2AdSet({
  draft,
  errors,
  onChange,
  cboEnabled,
}: {
  draft: AdsetDraft;
  errors: Errors;
  onChange: (patch: Partial<AdsetDraft>) => void;
  cboEnabled: boolean;
}) {
  const E = ({ k }: { k: string }) =>
    errors[k] ? <p className="text-[11px] text-destructive">{errors[k]}</p> : null;
  const toggleArr = <T extends string>(arr: T[], v: T) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Nombre del conjunto *</Label>
          <Input value={draft.name} onChange={(e) => onChange({ name: e.target.value })} />
          <E k="name" />
        </div>
        <div className="space-y-1">
          <Label>Estado al publicar</Label>
          <Select
            value={draft.status}
            onValueChange={(v) => onChange({ status: v as AdsetDraft["status"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PAUSED">Pausado</SelectItem>
              <SelectItem value="ACTIVE">Activo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!cboEnabled && (
        <div className="rounded-md border p-3 space-y-3">
          <Label className="text-sm font-medium">Presupuesto del conjunto</Label>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={draft.budgetType}
                onValueChange={(v) => onChange({ budgetType: v as AdsetDraft["budgetType"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="lifetime">Total</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Monto (CLP) *</Label>
              <Input
                type="number"
                value={draft.budgetAmount ?? ""}
                onChange={(e) =>
                  onChange({ budgetAmount: e.target.value ? Number(e.target.value) : null })
                }
              />
              <E k="budgetAmount" />
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Inicio (opcional, hereda de campaña)</Label>
          <Input
            type="datetime-local"
            value={draft.startTime ?? ""}
            onChange={(e) => onChange({ startTime: e.target.value || null })}
          />
        </div>
        <div className="space-y-1">
          <Label>Fin (opcional)</Label>
          <Input
            type="datetime-local"
            value={draft.endTime ?? ""}
            onChange={(e) => onChange({ endTime: e.target.value || null })}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Optimización de entrega *</Label>
          <Select
            value={draft.optimizationGoal}
            onValueChange={(v) =>
              onChange({ optimizationGoal: v as AdsetDraft["optimizationGoal"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(OPTIMIZATION_GOALS).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Evento de facturación *</Label>
          <Select
            value={draft.billingEvent}
            onValueChange={(v) => onChange({ billingEvent: v as AdsetDraft["billingEvent"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(BILLING_EVENTS).map(([k, l]) => (
                <SelectItem key={k} value={k}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Puja máxima (opcional)</Label>
          <Input
            type="number"
            value={draft.bidAmount ?? ""}
            onChange={(e) =>
              onChange({ bidAmount: e.target.value ? Number(e.target.value) : null })
            }
          />
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["audience", "placements"]}>
        <AccordionItem value="audience">
          <AccordionTrigger className="text-sm">Segmentación de audiencia</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="space-y-1">
              <Label>Países *</Label>
              <CountriesPicker
                value={draft.countries}
                onChange={(v) => onChange({ countries: v })}
              />
              <E k="countries" />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Ciudades / regiones</Label>
                <Input
                  value={draft.cities ?? ""}
                  onChange={(e) => onChange({ cities: e.target.value })}
                  placeholder="Santiago, Valparaíso…"
                />
              </div>
              <div className="space-y-1">
                <Label>Idiomas</Label>
                <Input
                  value={draft.languages ?? ""}
                  onChange={(e) => onChange({ languages: e.target.value })}
                  placeholder="es, en…"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Edad mín</Label>
                <Input
                  type="number"
                  min={13}
                  max={65}
                  value={draft.ageMin}
                  onChange={(e) => onChange({ ageMin: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label>Edad máx</Label>
                <Input
                  type="number"
                  min={13}
                  max={65}
                  value={draft.ageMax}
                  onChange={(e) => onChange({ ageMax: Number(e.target.value) })}
                />
                <E k="ageMax" />
              </div>
              <div className="space-y-1">
                <Label>Género</Label>
                <Select
                  value={draft.gender}
                  onValueChange={(v) => onChange({ gender: v as AdsetDraft["gender"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="male">Hombre</SelectItem>
                    <SelectItem value="female">Mujer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Intereses</Label>
              <TagsInput
                value={draft.interests}
                onChange={(v) => onChange({ interests: v })}
                placeholder="Ej. Yoga, Tecnología…"
              />
            </div>
            <div className="space-y-1">
              <Label>Comportamientos</Label>
              <TagsInput value={draft.behaviors} onChange={(v) => onChange({ behaviors: v })} />
            </div>
            <div className="space-y-1">
              <Label>Datos demográficos</Label>
              <TagsInput
                value={draft.demographics}
                onChange={(v) => onChange({ demographics: v })}
              />
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Audiencias personalizadas (IDs)</Label>
                <TagsInput
                  value={draft.customAudiences}
                  onChange={(v) => onChange({ customAudiences: v })}
                  placeholder="ID de audiencia"
                />
              </div>
              <div className="space-y-1">
                <Label>Audiencias similares (lookalike)</Label>
                <TagsInput
                  value={draft.lookalikeAudiences}
                  onChange={(v) => onChange({ lookalikeAudiences: v })}
                />
              </div>
              <div className="space-y-1">
                <Label>Exclusiones</Label>
                <TagsInput
                  value={draft.excludedAudiences}
                  onChange={(v) => onChange({ excludedAudiences: v })}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="placements">
          <AccordionTrigger className="text-sm">Ubicaciones</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <PlacementsPicker
              mode={draft.placementMode}
              placements={draft.placements}
              onMode={(m) => onChange({ placementMode: m })}
              onPlacements={(p) => onChange({ placements: p })}
            />
            <E k="placements" />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="devices">
          <AccordionTrigger className="text-sm">Dispositivos y red</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Plataformas</Label>
                {(["mobile", "desktop"] as const).map((p) => (
                  <label key={p} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={draft.devicePlatforms.includes(p)}
                      onCheckedChange={() =>
                        onChange({ devicePlatforms: toggleArr(draft.devicePlatforms, p) })
                      }
                    />
                    {p === "mobile" ? "Móvil" : "Escritorio"}
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sistema operativo</Label>
                {(["iOS", "Android"] as const).map((p) => (
                  <label key={p} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={draft.userOs.includes(p)}
                      onCheckedChange={() => onChange({ userOs: toggleArr(draft.userOs, p) })}
                    />
                    {p}
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Solo WiFi</Label>
                <div className="pt-1">
                  <Switch
                    checked={draft.wifiOnly}
                    onCheckedChange={(v) => onChange({ wifiOnly: v })}
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
