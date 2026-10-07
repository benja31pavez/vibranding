import { useState } from "react";
import { Copy, ExternalLink, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ConfirmDialog, StatusBadge } from "@/components/app";
import { displayUrl } from "@/lib/site/siteStatus";
import { downloadQrPng } from "@/components/site/qr";
import { copyPublicLink } from "@/components/site/copyLink";

/**
 * Cabecera compacta de los editores de sitio (una fila en escritorio):
 * navegación a la izquierda; estado, interruptor Publicar, link público
 * (clic = copiar), QR en PNG y "Ver publicado" (íconos con tooltip) a la derecha. Pasar a
 * borrador pide confirmación: el link y el QR impresos dejan de funcionar. `publicUrl` debe
 * ser la URL de producción (ver `landingPublicUrl` / `multilinkPublicUrlFor`).
 */
export function PublishBar({
  nav,
  published,
  publicUrl,
  onTogglePublished,
  toggling,
  readOnly,
  pageLabel,
  qrFileBase,
}: {
  /** Barra de pestañas (página + vista). */
  nav: React.ReactNode;
  published: boolean;
  publicUrl: string;
  onTogglePublished?: () => void;
  toggling?: boolean;
  /** Solo lectura: sin interruptor Publicar. */
  readOnly?: boolean;
  /** "el multienlace" / "la landing", para los textos de confirmación. */
  pageLabel: string;
  /** Nombre base del PNG del QR. */
  qrFileBase: string;
}) {
  const [confirmDraft, setConfirmDraft] = useState(false);
  const onSwitch = (next: boolean) => {
    if (!onTogglePublished) return;
    if (!next) return setConfirmDraft(true);
    onTogglePublished();
  };
  const downloadQr = async () => {
    try {
      await downloadQrPng(publicUrl, qrFileBase);
      if (!published) toast("QR descargado. Funcionará cuando publiques.");
    } catch {
      toast.error("No se pudo generar el QR. Inténtalo de nuevo.");
    }
  };
  const copy = () => copyPublicLink(publicUrl, published);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="min-w-0 max-w-full">{nav}</div>
      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
        {/* Editable: el interruptor dice el estado (una sola fuente, sin badge duplicado). */}
        {!readOnly && onTogglePublished ? (
          <label
            className={`mr-1 flex items-center gap-2 text-sm font-medium ${published ? "text-success-strong" : "text-warning-strong"}`}
          >
            <Switch
              checked={published}
              onCheckedChange={onSwitch}
              disabled={toggling}
              aria-label={published ? "Publicado. Pasar a borrador" : "Borrador. Publicar"}
            />
            {published ? "Publicado" : "Borrador"}
          </label>
        ) : (
          <StatusBadge
            status={published ? "published" : "draft"}
            label={published ? "Publicado" : "Borrador"}
            tone={published ? "success" : "warning"}
          />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void copy()}
          title={`Copiar link: ${publicUrl}`}
          className="h-8 max-w-[16rem] gap-1.5 px-2 font-normal min-[1400px]:px-3"
        >
          <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="sr-only">Copiar link: </span>
          {/* Con poco ancho queda solo el ícono (el link va en el title) para no partir la fila. */}
          <span className="hidden truncate min-[1400px]:inline">{displayUrl(publicUrl)}</span>
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => void downloadQr()}
                aria-label="Descargar QR en PNG"
              >
                <QrCode className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Descargar QR (PNG)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              {published ? (
                <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                  <a href={publicUrl} target="_blank" rel="noreferrer" aria-label="Ver publicado">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
              ) : (
                // span: un botón deshabilitado no recibe foco ni hover para el tooltip
                <span tabIndex={0} aria-label="Ver publicado (no disponible: es borrador)">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </span>
              )}
            </TooltipTrigger>
            <TooltipContent>
              {published ? "Ver publicado" : "Publica la página para verla en su URL pública"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <ConfirmDialog
        open={confirmDraft}
        onOpenChange={setConfirmDraft}
        title={`¿Pasar ${pageLabel} a borrador?`}
        description="El link y el QR dejan de funcionar hasta que vuelvas a publicar. Lo editado no se pierde."
        confirmLabel="Pasar a borrador"
        destructive
        onConfirm={() => {
          setConfirmDraft(false);
          onTogglePublished?.();
        }}
      />
    </div>
  );
}
