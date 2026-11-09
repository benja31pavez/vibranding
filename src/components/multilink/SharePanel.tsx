import { Copy, ExternalLink, QrCode, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app";
import { copyPublicLink } from "@/components/site/copyLink";
import { BrandTile } from "@/components/multilink/editor/BrandTile";
import { QrCodeCard } from "@/components/multilink/QrCodeCard";
import { displayUrl } from "@/lib/site/siteStatus";

const WHERE: { kind: "instagram" | "tiktok" | "whatsapp"; text: string }[] = [
  { kind: "instagram", text: "Bio de Instagram: Editar perfil → Enlaces." },
  { kind: "tiktok", text: "Bio de TikTok: Editar perfil → Sitio web." },
  { kind: "whatsapp", text: "Perfil y estados de WhatsApp Business." },
];

/** Pestaña "Compartir y QR": link público a mano, dónde ponerlo y el QR con estilo. */
export function SharePanel({
  publicUrl,
  published,
  fileBase,
  accent,
  title,
}: {
  publicUrl: string;
  published: boolean;
  fileBase: string;
  accent: string;
  title: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <div className="space-y-4">
        <section
          aria-labelledby="ml-link-title"
          className="rounded-app-lg border border-border-subtle bg-surface p-5 shadow-app-xs"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="ml-link-title" className="text-base font-semibold">
              Link público
            </h2>
            <StatusBadge
              status={published ? "published" : "draft"}
              label={published ? "Publicado" : "Borrador"}
              tone={published ? "success" : "warning"}
            />
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-app-md border border-border-subtle bg-surface-2 py-1.5 pl-3 pr-1.5">
            <span className="min-w-0 flex-1 truncate font-medium" title={publicUrl}>
              {displayUrl(publicUrl)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void copyPublicLink(publicUrl, published)}
            >
              <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" /> Copiar
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden="true" /> Abrir página
              </a>
            </Button>
          </div>
          {!published && (
            <p className="mt-3 rounded-app-md bg-warning-subtle px-3 py-2 text-sm font-medium text-warning-strong">
              Aún es borrador: publícalo para que el link y el QR funcionen.
            </p>
          )}
        </section>

        <section
          aria-labelledby="ml-where-title"
          className="rounded-app-lg border border-border-subtle bg-surface p-5 shadow-app-xs"
        >
          <h2 id="ml-where-title" className="text-base font-semibold">
            Dónde usarlo
          </h2>
          <ul className="mt-3 space-y-2.5 text-sm">
            {WHERE.map((w) => (
              <li key={w.kind} className="flex items-center gap-3">
                <BrandTile kind={w.kind} />
                <span>{w.text}</span>
              </li>
            ))}
            <li className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-1">
                <QrCode className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span>El QR en tarjetas, packaging y vehículos.</span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-1">
                <Store className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span>Vitrina o mesón del local: un QR grande a la altura de la vista.</span>
            </li>
          </ul>
        </section>
      </div>

      <QrCodeCard url={publicUrl} fileBase={fileBase} accent={accent} title={title} />
    </div>
  );
}
