import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, X, GripVertical, FileText, Link as LinkIcon, Image as ImageIcon, ListChecks, ShoppingBag, Type } from "lucide-react";
import { MediaUpload } from "@/components/MediaUpload";

export type ActionKind = "text" | "link" | "document" | "image" | "poll" | "catalog";

export type CatalogItem = { name: string; price?: string; url?: string; image_url?: string };

export type Action =
  | { kind: "text"; body: string }
  | { kind: "link"; url: string; caption?: string }
  | { kind: "document"; url: string; filename?: string; caption?: string }
  | { kind: "image"; url: string; caption?: string }
  | { kind: "poll"; question: string; options: string[] }
  | { kind: "catalog"; title?: string; items: CatalogItem[] };

export const ACTION_META: Record<ActionKind, { label: string; icon: any }> = {
  text: { label: "Texto", icon: Type },
  link: { label: "Enlace", icon: LinkIcon },
  document: { label: "Documento", icon: FileText },
  image: { label: "Imagen", icon: ImageIcon },
  poll: { label: "Encuesta", icon: ListChecks },
  catalog: { label: "Catálogo", icon: ShoppingBag },
};

export function defaultAction(kind: ActionKind): Action {
  switch (kind) {
    case "text":
      return { kind: "text", body: "" };
    case "link":
      return { kind: "link", url: "", caption: "" };
    case "document":
      return { kind: "document", url: "", filename: "", caption: "" };
    case "image":
      return { kind: "image", url: "", caption: "" };
    case "poll":
      return { kind: "poll", question: "", options: ["", ""] };
    case "catalog":
      return { kind: "catalog", title: "", items: [{ name: "" }] };
  }
}

export function ActionEditor({
  clientId,
  action,
  onChange,
  onRemove,
  onMove,
}: {
  clientId: string;
  action: Action;
  onChange: (p: Partial<Action>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const Meta = ACTION_META[action.kind];
  const Icon = Meta.icon;

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onMove(-1)}
          className="text-muted-foreground hover:text-foreground"
          title="Subir"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <Icon className="w-4 h-4 text-primary" />
        <span className="text-xs font-medium flex-1">{Meta.label}</span>
        <Button size="icon" variant="ghost" onClick={onRemove} className="h-7 w-7">
          <X className="w-3 h-3" />
        </Button>
      </div>

      {action.kind === "text" && (
        <Textarea
          value={action.body}
          onChange={(e) => onChange({ body: e.target.value } as Partial<Action>)}
          rows={3}
          placeholder="Mensaje que enviará el bot"
        />
      )}

      {action.kind === "link" && (
        <div className="space-y-2">
          <Input
            value={action.url}
            onChange={(e) => onChange({ url: e.target.value } as Partial<Action>)}
            placeholder="https://tusitio.com"
          />
          <Input
            value={action.caption ?? ""}
            onChange={(e) => onChange({ caption: e.target.value } as Partial<Action>)}
            placeholder="Texto opcional antes del enlace"
          />
        </div>
      )}

      {action.kind === "image" && (
        <div className="space-y-2">
          <MediaUpload
            clientId={clientId}
            value={action.url || null}
            onChange={(url) => onChange({ url: url ?? "" } as Partial<Action>)}
            placeholder="URL de la imagen"
          />
          <Input
            value={action.caption ?? ""}
            onChange={(e) => onChange({ caption: e.target.value } as Partial<Action>)}
            placeholder="Pie de imagen (opcional)"
          />
        </div>
      )}

      {action.kind === "document" && (
        <div className="space-y-2">
          <Input
            value={action.url}
            onChange={(e) => onChange({ url: e.target.value } as Partial<Action>)}
            placeholder="URL pública del documento (PDF, etc.)"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={action.filename ?? ""}
              onChange={(e) =>
                onChange({ filename: e.target.value } as Partial<Action>)
              }
              placeholder="Nombre del archivo (ej. catalogo.pdf)"
            />
            <Input
              value={action.caption ?? ""}
              onChange={(e) =>
                onChange({ caption: e.target.value } as Partial<Action>)
              }
              placeholder="Mensaje opcional"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            WhatsApp requiere una URL pública. Sube el archivo a tu servidor o usa un enlace
            directo.
          </p>
        </div>
      )}

      {action.kind === "poll" && (
        <PollEditor action={action} onChange={onChange} />
      )}

      {action.kind === "catalog" && (
        <CatalogEditor clientId={clientId} action={action} onChange={onChange} />
      )}
    </div>
  );
}

function PollEditor({
  action,
  onChange,
}: {
  action: Extract<Action, { kind: "poll" }>;
  onChange: (p: Partial<Action>) => void;
}) {
  const setOption = (i: number, v: string) => {
    const next = [...action.options];
    next[i] = v;
    onChange({ options: next } as Partial<Action>);
  };
  const addOption = () => {
    if (action.options.length >= 10) return;
    onChange({ options: [...action.options, ""] } as Partial<Action>);
  };
  const removeOption = (i: number) =>
    onChange({ options: action.options.filter((_, j) => j !== i) } as Partial<Action>);

  return (
    <div className="space-y-2">
      <Input
        value={action.question}
        onChange={(e) => onChange({ question: e.target.value } as Partial<Action>)}
        placeholder="Pregunta de la encuesta"
      />
      <div className="space-y-1.5">
        {action.options.map((o, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={o}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Opción ${i + 1}`}
              maxLength={24}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={() => removeOption(i)}
              className="h-9 w-9"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="outline"
          onClick={addOption}
          disabled={action.options.length >= 10}
        >
          <Plus className="w-3 h-3 mr-1" /> Opción
        </Button>
        <p className="text-[10px] text-muted-foreground">
          1-3 opciones → botones. 4-10 → lista desplegable.
        </p>
      </div>
    </div>
  );
}

function CatalogEditor({
  clientId,
  action,
  onChange,
}: {
  clientId: string;
  action: Extract<Action, { kind: "catalog" }>;
  onChange: (p: Partial<Action>) => void;
}) {
  const updateItem = (i: number, patch: Partial<CatalogItem>) => {
    const next = action.items.map((it, j) => (j === i ? { ...it, ...patch } : it));
    onChange({ items: next } as Partial<Action>);
  };
  const addItem = () =>
    onChange({ items: [...action.items, { name: "" }] } as Partial<Action>);
  const removeItem = (i: number) =>
    onChange({ items: action.items.filter((_, j) => j !== i) } as Partial<Action>);

  return (
    <div className="space-y-2">
      <Input
        value={action.title ?? ""}
        onChange={(e) => onChange({ title: e.target.value } as Partial<Action>)}
        placeholder="Encabezado (ej: 'Estos son nuestros productos:')"
      />
      <div className="space-y-2">
        {action.items.map((it, i) => (
          <div key={i} className="border rounded-md p-2 bg-background space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{i + 1}</span>
              <Input
                value={it.name}
                onChange={(e) => updateItem(i, { name: e.target.value })}
                placeholder="Nombre del producto"
                className="flex-1"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeItem(i)}
                className="h-7 w-7"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={it.price ?? ""}
                onChange={(e) => updateItem(i, { price: e.target.value })}
                placeholder="Precio (ej: $25.000)"
              />
              <Input
                value={it.url ?? ""}
                onChange={(e) => updateItem(i, { url: e.target.value })}
                placeholder="Enlace al producto"
              />
            </div>
            <MediaUpload
              clientId={clientId}
              value={it.image_url || null}
              onChange={(url) => updateItem(i, { image_url: url ?? undefined })}
              placeholder="URL de la imagen"
            />
          </div>
        ))}
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={addItem}
        disabled={action.items.length >= 10}
      >
        <Plus className="w-3 h-3 mr-1" /> Producto
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Máximo 10 productos. Cada producto se envía como un mensaje con su imagen, precio y
        enlace.
      </p>
    </div>
  );
}
