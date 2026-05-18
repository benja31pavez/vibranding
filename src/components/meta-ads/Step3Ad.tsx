import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MediaUpload } from "@/components/MediaUpload";
import { CTAS, LIMITS } from "@/lib/meta-ads/constants";
import type { AdDraft } from "@/lib/meta-ads/schemas";
import { CarouselCardsEditor } from "./CarouselCardsEditor";
import { UtmBuilder } from "./UtmBuilder";

type Errors = Record<string, string>;
type PageOpt = { id: string; name: string };
type IgOpt = { id: string; username: string };

export function Step3Ad({
  clientId, draft, errors, onChange, pages, igs,
}: {
  clientId: string;
  draft: AdDraft; errors: Errors;
  onChange: (patch: Partial<AdDraft>) => void;
  pages: PageOpt[]; igs: IgOpt[];
}) {
  const E = ({ k }: { k: string }) => errors[k] ? <p className="text-[11px] text-destructive">{errors[k]}</p> : null;
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Nombre del anuncio *</Label>
          <Input value={draft.name} onChange={(e) => onChange({ name: e.target.value })} />
          <E k="name" />
        </div>
        <div className="space-y-1">
          <Label>Estado al publicar</Label>
          <Select value={draft.status} onValueChange={(v) => onChange({ status: v as AdDraft["status"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PAUSED">Pausado</SelectItem>
              <SelectItem value="ACTIVE">Activo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border p-3 space-y-3">
        <Label className="text-sm font-medium">Identidad</Label>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Página de Facebook *</Label>
            <Select value={draft.pageId} onValueChange={(v) => onChange({ pageId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {pages.length === 0 && <div className="p-2 text-xs text-muted-foreground">Sin páginas detectadas</div>}
                {pages.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <E k="pageId" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cuenta de Instagram (opcional)</Label>
            <Select value={draft.instagramActorId ?? ""} onValueChange={(v) => onChange({ instagramActorId: v || null })}>
              <SelectTrigger><SelectValue placeholder="Solo Facebook" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Ninguna (solo Facebook)</SelectItem>
                {igs.map((i) => <SelectItem key={i.id} value={i.id}>@{i.username || i.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs value={draft.format} onValueChange={(v) => onChange({ format: v as AdDraft["format"] })}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="image">Imagen</TabsTrigger>
          <TabsTrigger value="video">Video</TabsTrigger>
          <TabsTrigger value="carousel">Carrusel</TabsTrigger>
          <TabsTrigger value="collection">Colección</TabsTrigger>
        </TabsList>

        <TabsContent value="image" className="space-y-2 pt-3">
          <Label className="text-xs">Imagen (JPG/PNG, máx 30MB)</Label>
          <MediaUpload value={draft.imageUrl ?? null} onChange={(v) => onChange({ imageUrl: v ?? "" })} clientId={clientId} />
          <E k="imageUrl" />
        </TabsContent>

        <TabsContent value="video" className="space-y-2 pt-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Video (MP4/MOV)</Label>
              <Input placeholder="https://…video.mp4" value={draft.videoUrl ?? ""} onChange={(e) => onChange({ videoUrl: e.target.value })} />
              <E k="videoUrl" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Miniatura / cover</Label>
              <MediaUpload value={draft.thumbnailUrl ?? null} onChange={(v) => onChange({ thumbnailUrl: v ?? "" })} clientId={clientId} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="carousel" className="space-y-3 pt-3">
          <CarouselCardsEditor
            clientId={clientId}
            cards={draft.carouselCards}
            onChange={(c) => onChange({ carouselCards: c })}
          />
          <E k="carouselCards" />
          <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch checked={draft.optimizeCarouselOrder} onCheckedChange={(v) => onChange({ optimizeCarouselOrder: v })} />
              Optimizar orden automáticamente
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch checked={draft.multiShareEndCard} onCheckedChange={(v) => onChange({ multiShareEndCard: v })} />
              Tarjeta final con foto de perfil
            </label>
          </div>
        </TabsContent>

        <TabsContent value="collection" className="pt-3">
          <p className="text-xs text-muted-foreground rounded-md border border-dashed p-3">
            Formato "Colección" disponible en próxima fase. Por ahora usa imagen, video o carrusel.
          </p>
        </TabsContent>
      </Tabs>

      <div className="space-y-3 rounded-md border p-3">
        <Label className="text-sm font-medium">Texto</Label>
        <div className="space-y-1">
          <Label className="text-xs">Texto principal ({(draft.primaryText ?? "").length}/{LIMITS.PRIMARY_TEXT})</Label>
          <Textarea maxLength={LIMITS.PRIMARY_TEXT} value={draft.primaryText ?? ""} onChange={(e) => onChange({ primaryText: e.target.value })} rows={3} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Titular ({(draft.headline ?? "").length}/{LIMITS.HEADLINE})</Label>
            <Input maxLength={LIMITS.HEADLINE} value={draft.headline ?? ""} onChange={(e) => onChange({ headline: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descripción ({(draft.description ?? "").length}/{LIMITS.DESCRIPTION})</Label>
            <Input maxLength={LIMITS.DESCRIPTION} value={draft.description ?? ""} onChange={(e) => onChange({ description: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <Label className="text-sm font-medium">Destino</Label>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">URL de destino *</Label>
            <Input placeholder="https://tusitio.com/landing" value={draft.linkUrl} onChange={(e) => onChange({ linkUrl: e.target.value })} />
            <E k="linkUrl" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL de visualización (opcional)</Label>
            <Input placeholder="tusitio.com" value={draft.displayUrl ?? ""} onChange={(e) => onChange({ displayUrl: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Call to action</Label>
            <Select value={draft.cta} onValueChange={(v) => onChange({ cta: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CTAS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value="utm" className="border-0">
            <AccordionTrigger className="text-xs py-2">Parámetros UTM (opcional)</AccordionTrigger>
            <AccordionContent>
              <UtmBuilder value={draft.utmParams ?? {}} onChange={(v) => onChange({ utmParams: v })} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
