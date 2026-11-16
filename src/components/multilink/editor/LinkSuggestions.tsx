import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandTile } from "@/components/multilink/editor/BrandTile";
import type { LinkSuggestion } from "@/components/multilink/editor/suggestedLinks";
import { formatChileMobile } from "@/lib/site/validation";

/** Fila de sugerencias: un clic agrega el enlace ya completo (o todos de una vez). */
export function LinkSuggestions({
  suggestions,
  onAdd,
}: {
  suggestions: LinkSuggestion[];
  onAdd: (list: LinkSuggestion[]) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="rounded-app-lg border border-dashed border-primary/30 bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Con datos del cliente
        </p>
        {suggestions.length > 1 && (
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onAdd(suggestions)}>
            Agregar todos
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant="outline"
            className="bg-background"
            onClick={() => onAdd([s])}
            title={s.wa ? formatChileMobile(s.wa) : s.url}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <BrandTile kind={s.kind} size="sm" />
            {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
