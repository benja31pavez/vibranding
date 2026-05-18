import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { CTAS, LIMITS } from "@/lib/meta-ads/constants";
import { MediaUpload } from "@/components/MediaUpload";

export type CarouselCard = {
  image_url?: string; video_url?: string;
  headline?: string; description?: string; link_url: string; cta: string;
};

export function CarouselCardsEditor({
  clientId, cards, onChange,
}: { clientId: string; cards: CarouselCard[]; onChange: (c: CarouselCard[]) => void }) {
  const add = () => {
    if (cards.length >= LIMITS.CAROUSEL_MAX) return;
    onChange([...cards, { link_url: "", cta: "LEARN_MORE" }]);
  };
  const update = (i: number, patch: Partial<CarouselCard>) =>
    onChange(cards.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(cards.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {cards.map((c, i) => (
        <div key={i} className="rounded-md border p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">Tarjeta {i + 1}</div>
            <Button size="sm" variant="ghost" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Imagen</Label>
              <MediaUpload value={c.image_url ?? ""} onChange={(v) => update(i, { image_url: v })} clientId={clientId} accept="image/*" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Titular ({(c.headline ?? "").length}/{LIMITS.HEADLINE})</Label>
              <Input maxLength={LIMITS.HEADLINE} value={c.headline ?? ""} onChange={(e) => update(i, { headline: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Descripción ({(c.description ?? "").length}/{LIMITS.DESCRIPTION})</Label>
              <Input maxLength={LIMITS.DESCRIPTION} value={c.description ?? ""} onChange={(e) => update(i, { description: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">URL de destino</Label>
              <Input placeholder="https://…" value={c.link_url} onChange={(e) => update(i, { link_url: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px]">Call to action</Label>
              <Select value={c.cta} onValueChange={(v) => update(i, { cta: v })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CTAS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={add} disabled={cards.length >= LIMITS.CAROUSEL_MAX}>
        <Plus className="w-3 h-3 mr-1" /> Añadir tarjeta ({cards.length}/{LIMITS.CAROUSEL_MAX})
      </Button>
    </div>
  );
}
