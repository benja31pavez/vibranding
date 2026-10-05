import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { COUNTRIES } from "@/lib/meta-ads/constants";
import { Check, X } from "lucide-react";

export function CountriesPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s),
    );
  }, [q]);
  const toggle = (code: string) => {
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  };
  return (
    <div className="rounded-md border space-y-2 p-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((code) => {
            const c = COUNTRIES.find((x) => x.code === code);
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs"
              >
                {c?.name ?? code}
                <button type="button" onClick={() => toggle(code)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar país…"
        className="h-8"
      />
      <div className="max-h-40 overflow-auto rounded border bg-background">
        {filtered.map((c) => {
          const on = value.includes(c.code);
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => toggle(c.code)}
              className={`w-full flex items-center justify-between px-2 py-1 text-xs hover:bg-muted ${on ? "bg-primary/5" : ""}`}
            >
              <span>
                {c.name} <span className="text-muted-foreground">({c.code})</span>
              </span>
              {on && <Check className="w-3 h-3 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
