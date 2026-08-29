import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { QrCode, Download } from "lucide-react";

/** QR for the public multilink URL, downloadable as PNG (high-res) and SVG. */
export function QrCodeCard({ url, fileBase }: { url: string; fileBase: string }) {
  const [dark, setDark] = useState("#0a0a0a");
  const [light, setLight] = useState("#ffffff");
  const [preview, setPreview] = useState<string | null>(null);
  const opts = useMemo(
    () => ({ margin: 2, color: { dark, light }, errorCorrectionLevel: "M" as const }),
    [dark, light],
  );

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { ...opts, width: 420 })
      .then((d) => !cancelled && setPreview(d))
      .catch(() => !cancelled && setPreview(null));
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
    // 1024px: enough resolution for flyers, packaging and storefront vinyl.
    const data = await QRCode.toDataURL(url, { ...opts, width: 1024 });
    download(data, "png");
  };

  const downloadSvg = async () => {
    const svg = await QRCode.toString(url, { ...opts, type: "svg" });
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    download(href, "svg");
    URL.revokeObjectURL(href);
  };

  return (
    <section className="rounded-2xl border bg-surface p-5 space-y-4">
      <h3 className="font-medium flex items-center gap-2">
        <QrCode className="w-4 h-4" /> Código QR
      </h3>
      <p className="text-xs text-muted-foreground">
        Apunta a {url}. Descárgalo en PNG (1024 px) para flyers y packaging, o en SVG para
        imprentas y gráfica de gran formato.
      </p>
      <div className="flex flex-wrap items-center gap-5">
        <div className="rounded-xl border p-3 bg-white">
          {preview ? (
            <img src={preview} alt="Código QR del multienlace" className="w-40 h-40" />
          ) : (
            <div className="w-40 h-40 grid place-items-center text-xs text-muted-foreground">
              Generando…
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div>
              <Label className="text-xs">Color</Label>
              <Input
                type="color"
                value={dark}
                onChange={(e) => setDark(e.target.value)}
                className="w-16 h-9 p-1"
              />
            </div>
            <div>
              <Label className="text-xs">Fondo</Label>
              <Input
                type="color"
                value={light}
                onChange={(e) => setLight(e.target.value)}
                className="w-16 h-9 p-1"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={downloadPng}>
              <Download className="w-4 h-4 mr-1" /> PNG
            </Button>
            <Button size="sm" variant="outline" onClick={downloadSvg}>
              <Download className="w-4 h-4 mr-1" /> SVG
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
