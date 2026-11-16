import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { AlertTriangle, Check, Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contrastRatio } from "@/lib/landingTheme";
import { displayUrl } from "@/lib/site/siteStatus";
import { cn } from "@/lib/utils";

/** Bajo este contraste muchos lectores de QR fallan (sobre todo en impresión). */
const MIN_SCAN_CONTRAST = 4;
const PREVIEW_WIDTH = 480;
const PNG_WIDTH = 1024;

type Palette = { key: string; label: string; dark: string; light: string };

/** QR for the public multilink URL, downloadable as PNG (high-res) and SVG. */
export function QrCodeCard({
  url,
  fileBase,
  accent,
  title,
}: {
  url: string;
  fileBase: string;
  /** Color de marca del multienlace: se ofrece como combinación lista. */
  accent?: string;
  /** Nombre del negocio, para la tarjeta de muestra. */
  title?: string;
}) {
  const palettes = useMemo<Palette[]>(() => {
    const base: Palette[] = [
      { key: "clasico", label: "Clásico", dark: "#0a0a0a", light: "#ffffff" },
    ];
    if (accent && contrastRatio(accent, "#ffffff") >= MIN_SCAN_CONTRAST) {
      base.push({ key: "marca", label: "Marca", dark: accent, light: "#ffffff" });
      base.push({ key: "invertido", label: "Invertido", dark: "#ffffff", light: accent });
    }
    base.push({ key: "noche", label: "Noche", dark: "#ffffff", light: "#0a0a0a" });
    return base;
  }, [accent]);

  const [dark, setDark] = useState("#0a0a0a");
  const [light, setLight] = useState("#ffffff");
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const opts = useMemo(
    () => ({ margin: 2, color: { dark, light }, errorCorrectionLevel: "M" as const }),
    [dark, light],
  );
  const lowContrast = contrastRatio(dark, light) < MIN_SCAN_CONTRAST;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { ...opts, width: PREVIEW_WIDTH })
      .then((d) => {
        if (cancelled) return;
        setPreview(d);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url, opts]);

  const download = (href: string, ext: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = `${fileBase}-qr.${ext}`;
    a.click();
  };

  const downloadPng = async () => {
    try {
      // 1024px: enough resolution for flyers, packaging and storefront vinyl.
      download(await QRCode.toDataURL(url, { ...opts, width: PNG_WIDTH }), "png");
      toast.success("QR descargado en PNG");
    } catch {
      toast.error("No se pudo generar el PNG. Inténtalo de nuevo.");
    }
  };

  const downloadSvg = async () => {
    try {
      const svg = await QRCode.toString(url, { ...opts, type: "svg" });
      const href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      download(href, "svg");
      URL.revokeObjectURL(href);
      toast.success("QR descargado en SVG");
    } catch {
      toast.error("No se pudo generar el SVG. Inténtalo de nuevo.");
    }
  };

  return (
    <section
      aria-labelledby="ml-qr-title"
      className="rounded-app-lg border border-border-subtle bg-surface p-5 shadow-app-xs"
    >
      <h2 id="ml-qr-title" className="flex items-center gap-2 text-base font-semibold">
        <QrCode className="h-4 w-4 text-brand-1" aria-hidden="true" /> Código QR
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        PNG de 1024 px para flyers y packaging; SVG para imprentas y gran formato.
      </p>

      <div className="mt-5 grid items-center gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
        {/* Tarjeta de muestra: así se ve impreso en una vitrina o tarjeta. */}
        <figure
          className="mx-auto w-52 rounded-[1.25rem] p-4 text-center shadow-app-md ring-1 ring-black/5 transition-colors"
          style={{ background: light, color: dark }}
        >
          {preview ? (
            <img
              src={preview}
              alt={`Código QR que abre ${displayUrl(url)}`}
              width={176}
              height={176}
              className="mx-auto h-44 w-44"
            />
          ) : (
            <div className="mx-auto grid h-44 w-44 place-items-center text-xs opacity-70">
              {failed ? "No se pudo generar" : "Generando…"}
            </div>
          )}
          <figcaption className="mt-2 space-y-0.5">
            {title && <span className="block truncate text-sm font-semibold">{title}</span>}
            <span className="block truncate text-xs opacity-75">{displayUrl(url)}</span>
          </figcaption>
        </figure>

        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted-foreground">Colores</legend>
            <div className="flex flex-wrap gap-2">
              {palettes.map((p) => {
                const active = p.dark === dark && p.light === light;
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setDark(p.dark);
                      setLight(p.light);
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border bg-surface py-1 pl-1 pr-3 text-sm transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-primary ring-1 ring-primary" : "border-border-subtle",
                    )}
                  >
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full ring-1 ring-black/10"
                      style={{ background: p.light, color: p.dark }}
                      aria-hidden="true"
                    >
                      {active ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <QrCode className="h-3.5 w-3.5" />
                      )}
                    </span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-center gap-4">
            <ColorInput label="Color" value={dark} onChange={setDark} />
            <ColorInput label="Fondo" value={light} onChange={setLight} />
          </div>
          {lowContrast && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-app-md bg-warning-subtle px-3 py-2 text-xs text-warning-strong"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Poco contraste entre color y fondo: algunos teléfonos no lo van a leer. Usa un color
              más oscuro sobre un fondo claro.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void downloadPng()} disabled={!preview}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" /> Descargar PNG
            </Button>
            <Button variant="outline" onClick={() => void downloadSvg()} disabled={!preview}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" /> SVG
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="relative h-8 w-8 overflow-hidden rounded-full border border-border-strong shadow-app-xs focus-within:ring-2 focus-within:ring-ring">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute -inset-2 h-12 w-12 cursor-pointer border-0 p-0"
        />
      </span>
      <span>
        {label} <span className="font-mono text-xs uppercase text-muted-foreground">{value}</span>
      </span>
    </label>
  );
}
