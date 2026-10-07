import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { withAlpha, type LandingPalette } from "@/lib/landingTheme";
import { SectionHeading } from "./parts";

type Channel = {
  key: string;
  icon: typeof Mail;
  label: string;
  value: string;
  href: string;
  external?: boolean;
  onClick?: () => void;
};

/**
 * Bloque de contacto: a la izquierda los canales directos (WhatsApp, teléfono,
 * email), a la derecha el formulario. En móvil se apilan con el formulario primero
 * después del texto, para que la acción quede cerca.
 */
export function ContactSection({
  palette: p,
  form,
  whatsappUrl,
  onWhatsappClick,
  phone,
  telHref,
  email,
  emailHref,
  place,
}: {
  palette: LandingPalette;
  form: React.ReactNode;
  whatsappUrl: string | null;
  onWhatsappClick?: () => void;
  phone: string | null;
  telHref: string | null;
  email?: string;
  emailHref: string | null;
  place?: string;
}) {
  const channels: Channel[] = [];
  if (whatsappUrl)
    channels.push({
      key: "wa",
      icon: MessageCircle,
      label: "WhatsApp",
      value: "Escríbenos un mensaje",
      href: whatsappUrl,
      external: true,
      onClick: onWhatsappClick,
    });
  if (phone && telHref)
    channels.push({ key: "tel", icon: Phone, label: "Teléfono", value: phone, href: telHref });
  if (email && emailHref)
    channels.push({ key: "mail", icon: Mail, label: "Email", value: email, href: emailHref });

  return (
    <div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 items-start">
      <div className="min-w-0 lg:sticky lg:top-24">
        <SectionHeading
          eyebrow="Hablemos"
          title="Cuéntanos qué necesitas"
          lead="Déjanos tus datos y te respondemos a la brevedad. Sin compromiso."
          palette={p}
          align="left"
          tight
        />
        {channels.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {channels.map((c) => (
              <li key={c.key} className="min-w-0">
                <a
                  href={c.href}
                  onClick={c.onClick}
                  {...(c.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="group flex items-center gap-4 rounded-2xl border p-4 transition hover:shadow-md motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ background: p.surface, borderColor: p.border, outlineColor: p.brand }}
                >
                  <span
                    className="grid place-items-center w-11 h-11 shrink-0 rounded-xl"
                    style={
                      c.key === "wa"
                        ? { background: "#25D366", color: "#0a0a0a" }
                        : {
                            background: withAlpha(p.brand, p.isDark ? 0.25 : 0.12),
                            color: p.brandText,
                          }
                    }
                    aria-hidden="true"
                  >
                    <c.icon className="w-5 h-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium" style={{ color: p.muted }}>
                      {c.label}
                    </span>
                    <span className="block font-semibold truncate">{c.value}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {place && (
          <p className="mt-5 text-sm inline-flex items-start gap-1.5" style={{ color: p.muted }}>
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            {place}
          </p>
        )}
      </div>
      <div className="min-w-0">{form}</div>
    </div>
  );
}
