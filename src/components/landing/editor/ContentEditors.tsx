import { ArrowDown, ArrowUp, Plus, Trash2, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, ImageUploadButton } from "@/components/site/fields";
import {
  SERVICE_ICON_KEYS,
  SERVICE_ICONS,
  type FaqItem,
  type GalleryItem,
  type Testimonial,
} from "@/lib/landingTheme";
import {
  isExampleText,
  TESTIMONIAL_PLACEHOLDER,
  type LandingDraft,
  type Service,
} from "@/lib/site/landingDraft";

type EditorProps = { lp: LandingDraft; onChange: (next: LandingDraft) => void; clientId: string };

function replaceAt<T>(list: T[], i: number, patch: Partial<T>): T[] {
  return list.map((x, k) => (k === i ? { ...x, ...patch } : x));
}
function removeAt<T>(list: T[], i: number): T[] {
  return list.filter((_, k) => k !== i);
}
function moveAt<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function RowActions({
  index,
  total,
  onMove,
  onRemove,
  label,
}: {
  index: number;
  total: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        aria-label={`Subir ${label}`}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        disabled={index === total - 1}
        onClick={() => onMove(1)}
        aria-label={`Bajar ${label}`}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={onRemove}
        aria-label={`Eliminar ${label}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ---------------- servicios ---------------- */

export function ServicesEditor({ lp, onChange }: EditorProps) {
  const set = (services: Service[]) => onChange({ ...lp, services });
  return (
    <div className="space-y-3">
      {lp.services.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Agrega los 3 a 6 servicios principales del negocio.
        </p>
      )}
      <ol className="space-y-2">
        {lp.services.map((s, i) => (
          <li key={i} className="space-y-2 rounded-xl border bg-background p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Field label={`Servicio ${i + 1}`} example={isExampleText(s.title)}>
                  {(a) => (
                    <Input
                      {...a}
                      value={s.title}
                      maxLength={80}
                      onChange={(e) => set(replaceAt(lp.services, i, { title: e.target.value }))}
                    />
                  )}
                </Field>
              </div>
              <div className="pt-5">
                <RowActions
                  index={i}
                  total={lp.services.length}
                  label={`servicio ${i + 1}`}
                  onMove={(d) => set(moveAt(lp.services, i, d))}
                  onRemove={() => set(removeAt(lp.services, i))}
                />
              </div>
            </div>
            <Field label="Descripción" example={isExampleText(s.description)}>
              {(a) => (
                <Textarea
                  {...a}
                  rows={2}
                  maxLength={300}
                  value={s.description}
                  onChange={(e) => set(replaceAt(lp.services, i, { description: e.target.value }))}
                />
              )}
            </Field>
            <div>
              <span className="text-xs font-medium">Ícono</span>
              <div
                className="mt-1 flex flex-wrap gap-1"
                role="radiogroup"
                aria-label={`Ícono del servicio ${i + 1}`}
              >
                <IconChoice
                  selected={!s.icon}
                  label="Número"
                  onClick={() => set(replaceAt(lp.services, i, { icon: undefined }))}
                >
                  <span className="text-[10px]">{i + 1}</span>
                </IconChoice>
                {SERVICE_ICON_KEYS.map((k) => {
                  const Icon = SERVICE_ICONS[k];
                  return (
                    <IconChoice
                      key={k}
                      selected={s.icon === k}
                      label={k}
                      onClick={() => set(replaceAt(lp.services, i, { icon: k }))}
                    >
                      <Icon className="h-4 w-4" />
                    </IconChoice>
                  );
                })}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <Button
        size="sm"
        variant="outline"
        onClick={() => set([...lp.services, { title: "", description: "" }])}
      >
        <Plus className="mr-1 h-4 w-4" /> Agregar servicio
      </Button>
    </div>
  );
}

function IconChoice({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md border ${selected ? "border-primary bg-primary/10" : "hover:bg-secondary"}`}
    >
      {children}
    </button>
  );
}

/* ---------------- galería + antes/después ---------------- */

export function GalleryEditor({ lp, onChange, clientId }: EditorProps) {
  const set = (gallery: GalleryItem[]) => onChange({ ...lp, gallery });
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Fotos reales de trabajos. Para un antes/después, agrega la foto de "Después" y luego súbele
        su "Antes".
      </p>
      {lp.gallery.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin imágenes todavía.</p>
      )}
      <ul className="space-y-2">
        {lp.gallery.map((g, i) => (
          <li key={`${g.url}-${i}`} className="flex gap-3 rounded-xl border bg-background p-3">
            <div className="flex shrink-0 gap-1">
              {g.before_url && (
                <img
                  src={g.before_url}
                  alt="Antes"
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-md object-cover opacity-80"
                />
              )}
              <img
                src={g.url}
                alt={g.alt || ""}
                width={64}
                height={64}
                className="h-16 w-16 rounded-md object-cover"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Field label="Descripción (también sirve como texto alternativo)">
                {(a) => (
                  <Input
                    {...a}
                    value={g.caption ?? ""}
                    maxLength={120}
                    placeholder="Ej: Jardín en Las Condes"
                    onChange={(e) => set(replaceAt(lp.gallery, i, { caption: e.target.value }))}
                  />
                )}
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                {g.before_url ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => set(replaceAt(lp.gallery, i, { before_url: null }))}
                  >
                    Quitar "Antes"
                  </Button>
                ) : (
                  <ImageUploadButton
                    clientId={clientId}
                    label='Agregar "Antes"'
                    onUploaded={([url]) => set(replaceAt(lp.gallery, i, { before_url: url }))}
                  />
                )}
              </div>
            </div>
            <RowActions
              index={i}
              total={lp.gallery.length}
              label={`imagen ${i + 1}`}
              onMove={(d) => set(moveAt(lp.gallery, i, d))}
              onRemove={() => set(removeAt(lp.gallery, i))}
            />
          </li>
        ))}
      </ul>
      <ImageUploadButton
        clientId={clientId}
        label="Subir fotos"
        multiple
        onUploaded={(urls) => set([...lp.gallery, ...urls.map((url) => ({ url }))])}
      />
    </div>
  );
}

/* ---------------- testimonios ---------------- */

export function TestimonialsEditor({ lp, onChange, clientId }: EditorProps) {
  const set = (testimonials: Testimonial[]) => onChange({ ...lp, testimonials });
  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
        <Quote className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        Usa sólo testimonios reales, con autorización del cliente. Los testimonios vacíos no se
        publican.
      </p>
      <ul className="space-y-2">
        {lp.testimonials.map((t, i) => (
          <li key={i} className="space-y-2 rounded-xl border bg-background p-3">
            <div className="flex items-start gap-2">
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <Field label="Nombre">
                  {(a) => (
                    <Input
                      {...a}
                      value={t.name}
                      maxLength={80}
                      placeholder="Nombre real del cliente"
                      onChange={(e) => set(replaceAt(lp.testimonials, i, { name: e.target.value }))}
                    />
                  )}
                </Field>
                <Field label="Comuna o detalle (opcional)">
                  {(a) => (
                    <Input
                      {...a}
                      value={t.role ?? ""}
                      maxLength={80}
                      placeholder="Ej: Clienta en Ñuñoa"
                      onChange={(e) => set(replaceAt(lp.testimonials, i, { role: e.target.value }))}
                    />
                  )}
                </Field>
              </div>
              <div className="pt-5">
                <RowActions
                  index={i}
                  total={lp.testimonials.length}
                  label={`testimonio ${i + 1}`}
                  onMove={(d) => set(moveAt(lp.testimonials, i, d))}
                  onRemove={() => set(removeAt(lp.testimonials, i))}
                />
              </div>
            </div>
            <Field label="Testimonio">
              {(a) => (
                <Textarea
                  {...a}
                  rows={2}
                  maxLength={400}
                  value={t.quote}
                  placeholder={TESTIMONIAL_PLACEHOLDER}
                  onChange={(e) => set(replaceAt(lp.testimonials, i, { quote: e.target.value }))}
                />
              )}
            </Field>
            <div className="flex items-center gap-3">
              {t.photo_url && (
                <img
                  src={t.photo_url}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover"
                />
              )}
              <ImageUploadButton
                clientId={clientId}
                label={t.photo_url ? "Cambiar foto" : "Foto (opcional)"}
                onUploaded={([url]) => set(replaceAt(lp.testimonials, i, { photo_url: url }))}
              />
            </div>
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="outline"
        onClick={() => set([...lp.testimonials, { name: "", quote: "" }])}
      >
        <Plus className="mr-1 h-4 w-4" /> Agregar testimonio
      </Button>
    </div>
  );
}

/* ---------------- preguntas frecuentes ---------------- */

export function FaqEditor({ lp, onChange }: EditorProps) {
  const set = (faq: FaqItem[]) => onChange({ ...lp, faq });
  return (
    <div className="space-y-3">
      {lp.faq.length === 0 && (
        <p className="text-sm text-muted-foreground">Sin preguntas todavía.</p>
      )}
      <ul className="space-y-2">
        {lp.faq.map((f, i) => (
          <li key={i} className="space-y-2 rounded-xl border bg-background p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <Field label={`Pregunta ${i + 1}`} example={isExampleText(f.question)}>
                  {(a) => (
                    <Input
                      {...a}
                      value={f.question}
                      maxLength={160}
                      onChange={(e) => set(replaceAt(lp.faq, i, { question: e.target.value }))}
                    />
                  )}
                </Field>
              </div>
              <div className="pt-5">
                <RowActions
                  index={i}
                  total={lp.faq.length}
                  label={`pregunta ${i + 1}`}
                  onMove={(d) => set(moveAt(lp.faq, i, d))}
                  onRemove={() => set(removeAt(lp.faq, i))}
                />
              </div>
            </div>
            <Field label="Respuesta" example={isExampleText(f.answer)}>
              {(a) => (
                <Textarea
                  {...a}
                  rows={2}
                  maxLength={800}
                  value={f.answer}
                  onChange={(e) => set(replaceAt(lp.faq, i, { answer: e.target.value }))}
                />
              )}
            </Field>
          </li>
        ))}
      </ul>
      <Button
        size="sm"
        variant="outline"
        onClick={() => set([...lp.faq, { question: "", answer: "" }])}
      >
        <Plus className="mr-1 h-4 w-4" /> Agregar pregunta
      </Button>
    </div>
  );
}
