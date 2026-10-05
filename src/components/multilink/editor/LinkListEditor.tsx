import { useState } from "react";
import { CalendarClock, ChevronDown, Globe, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, ImageUploadButton } from "@/components/site/fields";
import {
  MoveButtons,
  moveBy,
  SortableList,
  useSortableRow,
} from "@/components/site/SortableSections";
import { LinkIcon } from "@/components/multilink/LinkIcon";
import { scheduleState, type Multilink, type MultilinkItem } from "@/lib/multilink";
import { LINK_KIND_LABEL } from "@/lib/site/linkKind";
import { formatChileMobile, normalizeChileMobile, normalizeUrl } from "@/lib/site/validation";
import {
  itemLinkKind,
  newItem,
  QUICK_ADDS,
  urlPlaceholder,
  type ItemErrors,
  type QuickAdd,
} from "@/lib/site/multilinkDraft";

type Props = {
  ml: Multilink;
  items: MultilinkItem[];
  onChange: (items: MultilinkItem[]) => void;
  errors: ItemErrors;
  clientId: string;
  /** URL pública de la landing del cliente, si existe: se ofrece como botón rápido. */
  landingUrl: string | null;
};

export function LinkListEditor({ ml, items, onChange, errors, clientId, landingUrl }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const add = (quick: QuickAdd, url = "") => {
    const item = newItem(ml, quick, items.length, url);
    onChange([...items, item]);
    setExpanded(item.id);
  };
  const patch = (id: string, p: Partial<MultilinkItem>) =>
    onChange(items.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const remove = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
    toast("Enlace quitado. Se elimina al guardar (o usa Descartar para recuperarlo).");
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium">Agregar enlace</p>
        <div className="flex flex-wrap gap-2">
          {landingUrl && (
            <Button
              size="sm"
              variant="default"
              onClick={() =>
                add(
                  {
                    kind: "website",
                    label: "Landing",
                    title: "Conoce nuestros servicios",
                    placeholder: "",
                  },
                  landingUrl,
                )
              }
            >
              <Globe className="mr-1 h-4 w-4" aria-hidden="true" /> Landing del cliente
            </Button>
          )}
          {QUICK_ADDS.map((q) => (
            <Button key={q.kind} size="sm" variant="outline" onClick={() => add(q)}>
              <LinkIcon kind={q.kind === "video" ? "youtube" : q.kind} className="mr-1 h-4 w-4" />{" "}
              {q.label}
            </Button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Empieza por WhatsApp e Instagram: son los enlaces que más se usan.
        </p>
      ) : (
        <SortableList
          ids={items.map((i) => i.id)}
          onReorder={(ids) => onChange(ids.map((id) => items.find((i) => i.id === id)!))}
          getLabel={(id) => items.find((i) => i.id === id)?.title.trim() || "enlace sin título"}
        >
          <ul className="space-y-2">
            {items.map((i, idx) => (
              <LinkRow
                key={i.id}
                item={i}
                errors={errors}
                clientId={clientId}
                open={expanded === i.id}
                onToggle={() => setExpanded(expanded === i.id ? null : i.id)}
                onPatch={(p) => patch(i.id, p)}
                onRemove={() => remove(i.id)}
                onMove={(dir) => onChange(moveBy(items, idx, dir))}
                canMoveUp={idx > 0}
                canMoveDown={idx < items.length - 1}
              />
            ))}
          </ul>
        </SortableList>
      )}
    </div>
  );
}

function destinationLabel(i: MultilinkItem): string {
  if (i.kind === "whatsapp") {
    const n = normalizeChileMobile(i.wa_number);
    return n ? formatChileMobile(n) : "Falta el número";
  }
  const raw = i.kind === "video" ? i.video_url : i.url;
  return (raw ?? "").replace(/^https?:\/\/(www\.)?/, "") || "Falta la URL";
}

const SCHEDULE_UI = {
  live: null,
  scheduled: {
    label: "Programado",
    className: "border-amber-600/40 text-amber-800 dark:text-amber-300",
  },
  expired: { label: "Expirado", className: "text-muted-foreground" },
  off: { label: "Oculto", className: "text-muted-foreground" },
} as const;

function LinkRow({
  item: i,
  errors,
  clientId,
  open,
  onToggle,
  onPatch,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  item: MultilinkItem;
  errors: ItemErrors;
  clientId: string;
  open: boolean;
  onToggle: () => void;
  onPatch: (p: Partial<MultilinkItem>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const label = i.title.trim() || "enlace sin título";
  const { setNodeRef, style, handle, isDragging } = useSortableRow(i.id, label);
  const kind = itemLinkKind(i);
  const hasError = Object.keys(errors).some((k) => k.startsWith(`${i.id}.`));
  const badge = SCHEDULE_UI[scheduleState(i)];
  const panelId = `link-panel-${i.id}`;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-background ${isDragging ? "shadow-xl" : ""} ${hasError ? "border-destructive/60" : ""}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        {handle}
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary"
          title={LINK_KIND_LABEL[kind]}
        >
          <LinkIcon kind={kind} className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{i.title.trim() || "Sin título"}</span>
            {i.featured && (
              <Star
                className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500"
                aria-label="Destacado"
              />
            )}
            {badge && (
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${badge.className}`}
              >
                {badge.label}
              </span>
            )}
          </span>
          <span
            className={`block truncate text-xs ${hasError ? "text-destructive" : "text-muted-foreground"}`}
          >
            {destinationLabel(i)}
            {i.click_count > 0 ? ` · ${i.click_count} clics` : ""}
          </span>
        </button>
        <MoveButtons label={label} onMove={onMove} canUp={canMoveUp} canDown={canMoveDown} />
        <Switch
          checked={i.is_active}
          onCheckedChange={(v) => onPatch({ is_active: v })}
          aria-label={`Mostrar ${label}`}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onRemove}
          aria-label={`Quitar ${label}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </div>

      {open && (
        <div id={panelId} className="space-y-3 border-t px-3 pb-3 pt-3">
          <Field label="Texto del botón" error={errors[`${i.id}.title`]}>
            {(a) => (
              <Input
                {...a}
                value={i.title}
                maxLength={80}
                onChange={(e) => onPatch({ title: e.target.value })}
              />
            )}
          </Field>
          <DestinationFields item={i} errors={errors} onPatch={onPatch} />
          <Field label="Subtítulo (opcional)">
            {(a) => (
              <Input
                {...a}
                value={i.subtitle ?? ""}
                maxLength={120}
                placeholder="Ej: Respondemos en minutos"
                onChange={(e) => onPatch({ subtitle: e.target.value })}
              />
            )}
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <Switch checked={i.featured} onCheckedChange={(v) => onPatch({ featured: v })} />
              Destacar (botón grande)
            </label>
            {i.kind !== "video" && (
              <>
                {i.thumbnail_url && (
                  <img
                    src={i.thumbnail_url}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-md object-cover"
                  />
                )}
                <ImageUploadButton
                  clientId={clientId}
                  label={i.thumbnail_url ? "Cambiar miniatura" : "Miniatura (opcional)"}
                  onUploaded={([url]) => onPatch({ thumbnail_url: url })}
                />
                {i.thumbnail_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onPatch({ thumbnail_url: null })}
                  >
                    Quitar
                  </Button>
                )}
              </>
            )}
          </div>
          <details className="rounded-lg border bg-surface/50 p-3 text-sm">
            <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
              <CalendarClock className="h-4 w-4" aria-hidden="true" /> Programar (promociones con
              fecha)
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Field label="Aparece desde">
                {(a) => (
                  <Input
                    {...a}
                    type="datetime-local"
                    value={toLocalInput(i.start_at)}
                    onChange={(e) => onPatch({ start_at: fromLocalInput(e.target.value) })}
                  />
                )}
              </Field>
              <Field label="Desaparece el">
                {(a) => (
                  <Input
                    {...a}
                    type="datetime-local"
                    value={toLocalInput(i.end_at)}
                    onChange={(e) => onPatch({ end_at: fromLocalInput(e.target.value) })}
                  />
                )}
              </Field>
            </div>
          </details>
        </div>
      )}
    </li>
  );
}

function DestinationFields({
  item: i,
  errors,
  onPatch,
}: {
  item: MultilinkItem;
  errors: ItemErrors;
  onPatch: (p: Partial<MultilinkItem>) => void;
}) {
  if (i.kind === "whatsapp") {
    const normalized = normalizeChileMobile(i.wa_number);
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Número de WhatsApp"
          error={errors[`${i.id}.wa_number`]}
          hint="Celular chileno: +56 9 1234 5678"
        >
          {(a) => (
            <Input
              {...a}
              type="tel"
              inputMode="tel"
              placeholder="+56 9 1234 5678"
              maxLength={20}
              value={i.wa_number ?? ""}
              onChange={(e) => onPatch({ wa_number: e.target.value })}
              onBlur={() => normalized && onPatch({ wa_number: formatChileMobile(normalized) })}
            />
          )}
        </Field>
        <Field label="Mensaje precargado">
          {(a) => (
            <Input
              {...a}
              maxLength={300}
              value={i.wa_message ?? ""}
              onChange={(e) => onPatch({ wa_message: e.target.value })}
            />
          )}
        </Field>
      </div>
    );
  }
  if (i.kind === "video") {
    return (
      <Field
        label="Enlace del video"
        error={errors[`${i.id}.video_url`]}
        hint="YouTube, Vimeo o un archivo .mp4"
      >
        {(a) => (
          <Input
            {...a}
            inputMode="url"
            placeholder="https://youtube.com/watch?v=…"
            maxLength={500}
            value={i.video_url ?? ""}
            onChange={(e) => onPatch({ video_url: e.target.value })}
            onBlur={() => onPatch({ video_url: normalizeUrl(i.video_url) || null })}
          />
        )}
      </Field>
    );
  }
  if (i.kind === "social") {
    return (
      <Field label="Usuario o enlace" hint="Enlace de red social antiguo: se mantiene tal cual">
        {(a) => (
          <Input
            {...a}
            maxLength={500}
            value={i.url}
            onChange={(e) => onPatch({ url: e.target.value })}
          />
        )}
      </Field>
    );
  }
  return (
    <Field
      label="Destino"
      error={errors[`${i.id}.url`]}
      hint={`Ícono detectado: ${LINK_KIND_LABEL[itemLinkKind(i)]}`}
    >
      {(a) => (
        <Input
          {...a}
          inputMode="url"
          placeholder={urlPlaceholder(i)}
          maxLength={500}
          value={i.url}
          onChange={(e) => onPatch({ url: e.target.value })}
          onBlur={() => onPatch({ url: normalizeUrl(i.url) })}
        />
      )}
    </Field>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
