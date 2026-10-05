import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Field } from "@/components/site/fields";
import { defaultHours, WEEKDAYS, type LandingLocation, type OpeningHour } from "@/lib/landingTheme";
import { landingWhatsappText } from "@/lib/landingWhatsapp";
import { formatChileMobile, normalizeChileMobile } from "@/lib/site/validation";
import type { LandingDraft, LandingErrors } from "@/lib/site/landingDraft";

type EditorProps = {
  lp: LandingDraft;
  onChange: (next: LandingDraft) => void;
  errors: LandingErrors;
};

/* ---------------- llamado a WhatsApp ---------------- */

export function WhatsappEditor({ lp, onChange, errors }: EditorProps) {
  const normalized = normalizeChileMobile(lp.whatsapp_number);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Activa la banda de WhatsApp y el botón flotante. El mensaje lleva una referencia para saber
        que el contacto vino de esta landing.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Número de WhatsApp"
          error={errors.whatsapp_number}
          hint="Celular chileno: +56 9 1234 5678"
        >
          {(a) => (
            <Input
              {...a}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="+56 9 1234 5678"
              maxLength={20}
              value={lp.whatsapp_number ?? ""}
              onChange={(e) => onChange({ ...lp, whatsapp_number: e.target.value })}
              onBlur={() =>
                normalized && onChange({ ...lp, whatsapp_number: formatChileMobile(normalized) })
              }
            />
          )}
        </Field>
        <Field label="Título de la banda">
          {(a) => (
            <Input
              {...a}
              placeholder="Escríbenos por WhatsApp"
              maxLength={60}
              value={lp.whatsapp_cta_text ?? ""}
              onChange={(e) => onChange({ ...lp, whatsapp_cta_text: e.target.value })}
            />
          )}
        </Field>
      </div>
      <Field label="Mensaje precargado">
        {(a) => (
          <Textarea
            {...a}
            rows={2}
            maxLength={400}
            placeholder="Hola, vengo desde su página web y quiero más información."
            value={lp.whatsapp_message ?? ""}
            onChange={(e) => onChange({ ...lp, whatsapp_message: e.target.value })}
          />
        )}
      </Field>
      <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground whitespace-pre-line">
        <span className="mb-1 block font-medium text-foreground">Así llega el mensaje:</span>
        {landingWhatsappText(lp)}
      </div>
    </div>
  );
}

/* ---------------- ubicación, comunas y horarios ---------------- */

export function LocationEditor({ lp, onChange, errors }: EditorProps) {
  const loc = lp.location;
  const setLoc = (patch: Partial<LandingLocation>) =>
    onChange({ ...lp, location: { ...loc, ...patch } });
  const hours = loc.hours ?? defaultHours();
  const setHour = (i: number, patch: Partial<OpeningHour>) =>
    setLoc({ hours: hours.map((h, k) => (k === i ? { ...h, ...patch } : h)) });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Dirección (opcional)" hint="Déjala vacía si atiende sólo a domicilio">
          {(a) => (
            <Input
              {...a}
              maxLength={200}
              value={loc.address ?? ""}
              onChange={(e) => setLoc({ address: e.target.value })}
            />
          )}
        </Field>
        <Field label="Comuna principal" hint="Se usa para Google (SEO local)">
          {(a) => (
            <Input
              {...a}
              maxLength={60}
              placeholder="Ej: Providencia"
              value={loc.comuna ?? ""}
              onChange={(e) => setLoc({ comuna: e.target.value })}
            />
          )}
        </Field>
        <Field label="Región">
          {(a) => (
            <Input
              {...a}
              maxLength={60}
              placeholder="Región Metropolitana"
              value={loc.region ?? ""}
              onChange={(e) => setLoc({ region: e.target.value })}
            />
          )}
        </Field>
      </div>
      <ComunasInput value={loc.comunas ?? []} onChange={(comunas) => setLoc({ comunas })} />
      <Field
        label="Mapa de Google (opcional)"
        error={errors["location.map_embed_url"]}
        hint="Google Maps → Compartir → Insertar un mapa → copia sólo la URL del src"
      >
        {(a) => (
          <Input
            {...a}
            maxLength={800}
            placeholder="https://www.google.com/maps/embed?pb=..."
            value={loc.map_embed_url ?? ""}
            onChange={(e) =>
              setLoc({ map_embed_url: e.target.value.replace(/^.*src="([^"]+)".*$/s, "$1") })
            }
          />
        )}
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium">Horario de atención</legend>
        <ul className="space-y-2">
          {hours.map((h, i) => (
            <li
              key={h.day}
              className="grid grid-cols-[6rem_auto] items-center gap-2 text-sm sm:flex"
            >
              <span className="w-24 shrink-0">{WEEKDAYS[h.day]}</span>
              <label className="flex items-center gap-2 text-xs">
                <Switch
                  checked={!h.closed}
                  onCheckedChange={(v) => setHour(i, { closed: !v })}
                  aria-label={`${WEEKDAYS[h.day]} abierto`}
                />
                {h.closed ? "Cerrado" : "Abierto"}
              </label>
              {!h.closed && (
                <div className="col-span-2 flex items-center gap-2">
                  <Input
                    type="time"
                    step={1800}
                    value={h.from ?? "09:00"}
                    aria-label={`${WEEKDAYS[h.day]} desde`}
                    onChange={(e) => setHour(i, { from: e.target.value })}
                    className="h-8 w-28"
                  />
                  <span className="text-muted-foreground">a</span>
                  <Input
                    type="time"
                    step={1800}
                    value={h.to ?? "18:00"}
                    aria-label={`${WEEKDAYS[h.day]} hasta`}
                    onChange={(e) => setHour(i, { to: e.target.value })}
                    className="h-8 w-28"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </fieldset>
    </div>
  );
}

function ComunasInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const parts = text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((c) => !value.some((v) => v.toLowerCase() === c.toLowerCase()));
    if (parts.length) onChange([...value, ...parts]);
    setText("");
  };
  return (
    <Field
      label="Comunas donde atiende"
      hint="Escribe una o varias separadas por coma y presiona Enter"
    >
      {(a) => (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              {...a}
              value={text}
              placeholder="Ej: Las Condes, Vitacura, Lo Barnechea"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={add} disabled={!text.trim()}>
              Agregar
            </Button>
          </div>
          {value.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {value.map((c) => (
                <li
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full border bg-background py-0.5 pl-3 pr-1 text-sm"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((v) => v !== c))}
                    className="rounded-full p-1 hover:bg-secondary"
                    aria-label={`Quitar ${c}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Field>
  );
}

/* ---------------- formulario de contacto ---------------- */

export function ContactFormEditor({
  submissions,
  onOpenInbox,
}: {
  submissions: number;
  onOpenInbox: () => void;
}) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">
        Formulario con nombre, email, teléfono y mensaje. Tiene protección contra spam y límite de
        envíos.
      </p>
      <p>
        {submissions === 0
          ? "Aún no hay mensajes."
          : `${submissions} mensaje${submissions === 1 ? "" : "s"} recibido${submissions === 1 ? "" : "s"}.`}{" "}
        {submissions > 0 && (
          <Button variant="link" className="h-auto p-0" onClick={onOpenInbox}>
            Ver mensajes
          </Button>
        )}
      </p>
    </div>
  );
}
