import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type UtmParams = {
  source?: string; medium?: string; campaign?: string; term?: string; content?: string;
};

export function UtmBuilder({ value, onChange }: { value: UtmParams; onChange: (v: UtmParams) => void }) {
  const set = (k: keyof UtmParams) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {(["source", "medium", "campaign", "term", "content"] as const).map((k) => (
        <div key={k} className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">utm_{k}</Label>
          <Input value={value[k] ?? ""} onChange={set(k)} className="h-8" placeholder={`utm_${k}`} />
        </div>
      ))}
    </div>
  );
}

export function applyUtm(url: string, utm: UtmParams | undefined): string {
  if (!utm) return url;
  try {
    const u = new URL(url);
    (["source", "medium", "campaign", "term", "content"] as const).forEach((k) => {
      const v = utm[k]?.trim();
      if (v) u.searchParams.set(`utm_${k}`, v);
    });
    return u.toString();
  } catch { return url; }
}
