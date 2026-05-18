import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PLACEMENT_GROUPS } from "@/lib/meta-ads/constants";

export function PlacementsPicker({
  mode, placements, onMode, onPlacements,
}: {
  mode: "automatic" | "manual";
  placements: string[];
  onMode: (m: "automatic" | "manual") => void;
  onPlacements: (p: string[]) => void;
}) {
  const toggle = (id: string) =>
    onPlacements(placements.includes(id) ? placements.filter((p) => p !== id) : [...placements, id]);
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Ubicaciones</Label>
          <p className="text-xs text-muted-foreground">{mode === "automatic" ? "Meta elige las mejores ubicaciones automáticamente." : "Tú eliges dónde se muestran los anuncios."}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={mode === "automatic" ? "font-medium" : "text-muted-foreground"}>Automático</span>
          <Switch checked={mode === "manual"} onCheckedChange={(v) => onMode(v ? "manual" : "automatic")} />
          <span className={mode === "manual" ? "font-medium" : "text-muted-foreground"}>Manual</span>
        </div>
      </div>
      {mode === "manual" && (
        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t">
          {Object.entries(PLACEMENT_GROUPS).map(([group, items]) => (
            <div key={group}>
              <div className="text-xs font-semibold mb-1">{group}</div>
              <div className="space-y-1">
                {items.map((it) => (
                  <label key={it.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={placements.includes(it.id)} onCheckedChange={() => toggle(it.id)} />
                    {it.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
