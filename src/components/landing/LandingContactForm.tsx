import { useId, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitLandingContact } from "@/lib/landing/contact.functions";
import { trackEvent } from "@/lib/track";
import type { LandingPalette } from "@/lib/landingTheme";

const ContactSchema = z.object({
  name: z.string().trim().min(1, "Ingresa tu nombre").max(100),
  email: z.string().trim().email("Ingresa un email válido, por ejemplo nombre@correo.cl").max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().min(1, "Cuéntanos qué necesitas").max(2000),
});

type Field = keyof z.infer<typeof ContactSchema>;
type Errors = Partial<Record<Field, string>>;

const EMPTY = { name: "", email: "", phone: "", message: "" };

/**
 * Formulario de contacto de la landing pública. Usa los colores de la marca,
 * etiquetas visibles y errores por campo (WCAG AA). En la vista previa no envía.
 */
export function LandingContactForm({
  landingId,
  palette: p,
  preview,
  whatsappUrl,
}: {
  landingId: string;
  palette: LandingPalette;
  preview?: boolean;
  whatsappUrl?: string | null;
}) {
  const send = useServerFn(submitLandingContact);
  const uid = useId();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [trap, setTrap] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = (k: Field, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (preview) return;
    setServerError(null);
    const parsed = ContactSchema.safeParse(form);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as Field;
        if (!next[k]) next[k] = issue.message;
      }
      setErrors(next);
      const first = Object.keys(next)[0];
      if (first) document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    setSending(true);
    let res: { ok: boolean; reason?: string };
    try {
      res = await send({
        data: {
          landingId,
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone || "",
          message: parsed.data.message,
          honeypot: trap,
        },
      });
    } catch {
      res = { ok: false };
    }
    setSending(false);
    if (!res.ok) {
      setServerError(
        res.reason === "rate_limited"
          ? "Enviaste varios mensajes seguidos. Intenta de nuevo en un rato."
          : "No pudimos enviar tu mensaje. Revisa tu conexión e inténtalo otra vez.",
      );
      return;
    }
    trackEvent("contact_submit", { type: "landing", id: landingId });
    setSent(true);
    setForm(EMPTY);
  };

  const card = { background: p.surface, borderColor: p.border, color: p.text };
  const inputStyle = {
    background: p.isDark ? "#0f0f14" : "#ffffff",
    borderColor: p.isDark ? "#3f3f46" : "#a1a1aa",
    color: p.text,
  };

  if (sent) {
    return (
      <div role="status" className="rounded-2xl border p-8 text-center" style={card}>
        <CheckCircle2
          className="w-10 h-10 mx-auto"
          style={{ color: p.brandText }}
          aria-hidden="true"
        />
        <h3 className="mt-3 font-semibold text-lg">¡Mensaje enviado!</h3>
        <p className="text-sm mt-2" style={{ color: p.muted }}>
          Gracias por escribirnos. Te responderemos a la brevedad.
        </p>
      </div>
    );
  }

  const field = (k: Field, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <label htmlFor={`${uid}-${k}`} className="block text-sm font-medium mb-1.5">
        {label}
        {hint && (
          <span className="font-normal" style={{ color: p.muted }}>
            {" "}
            {hint}
          </span>
        )}
      </label>
      {input}
      {errors[k] && (
        <p
          id={`${uid}-${k}-error`}
          className="mt-1 text-sm"
          style={{ color: p.isDark ? "#fca5a5" : "#b91c1c" }}
        >
          {errors[k]}
        </p>
      )}
    </div>
  );

  const common = (k: Field) => ({
    id: `${uid}-${k}`,
    name: k,
    value: form[k],
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `${uid}-${k}-error` : undefined,
    className:
      "w-full rounded-lg border px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
    style: inputStyle,
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className="relative rounded-2xl border p-5 sm:p-6 space-y-4"
      style={card}
    >
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          No completar
          <input
            type="text"
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
            value={trap}
            onChange={(e) => setTrap(e.target.value)}
          />
        </label>
      </div>
      {field(
        "name",
        "Nombre",
        <input
          {...common("name")}
          type="text"
          autoComplete="name"
          maxLength={100}
          onChange={(e) => set("name", e.target.value)}
        />,
      )}
      {field(
        "email",
        "Email",
        <input
          {...common("email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={255}
          onChange={(e) => set("email", e.target.value)}
        />,
      )}
      {field(
        "phone",
        "Teléfono",
        <input
          {...common("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+56 9 1234 5678"
          maxLength={40}
          onChange={(e) => set("phone", e.target.value)}
        />,
        "(opcional)",
      )}
      {field(
        "message",
        "¿En qué te podemos ayudar?",
        <textarea
          {...common("message")}
          rows={4}
          maxLength={2000}
          onChange={(e) => set("message", e.target.value)}
        />,
      )}
      {serverError && (
        <p role="alert" className="text-sm" style={{ color: p.isDark ? "#fca5a5" : "#b91c1c" }}>
          {serverError}
        </p>
      )}
      <button
        type="submit"
        disabled={sending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-medium transition hover:opacity-90 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: p.brand, color: p.onBrand, outlineColor: p.brand }}
      >
        {sending && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        {sending ? "Enviando…" : "Enviar mensaje"}
      </button>
      {whatsappUrl && (
        <p className="text-center text-sm" style={{ color: p.muted }}>
          ¿Prefieres algo más rápido?{" "}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="underline font-medium"
            style={{ color: p.brandText }}
          >
            Escríbenos por WhatsApp
          </a>
        </p>
      )}
    </form>
  );
}
