import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Monitor, Smartphone } from "lucide-react";

export type PreviewMode = "mobile" | "desktop";

/** Móvil: proporción real de un teléfono actual (390 × 844, ~19,5:9). */
const VIEWPORT: Record<PreviewMode, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
};

/** Ancho visible del teléfono cuando no hay alto fijo (móvil: la página hace scroll). */
const PHONE_WIDTH = 300;
/** Tope del teléfono en escritorio, aunque sobre alto: un teléfono más grande se ve vacío. */
const PHONE_MAX_WIDTH = 330;
/** Marco negro (p-2) + borde inferior para la leyenda. */
const FRAME_PAD = 16;
const CAPTION_SPACE = 28;
/** Desde `md` el panel no hace scroll de página: la vista previa llena el alto disponible. */
const FIT_QUERY = "(min-width: 768px)";

function useMatchMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const sync = () => setMatches(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

/** Ancho mostrado: cabe en el ancho y, si `fitHeight`, también en el alto disponible. */
function displayWidthFor(
  mode: PreviewMode,
  box: { width: number; height: number },
  fitHeight: boolean,
): number {
  const vp = VIEWPORT[mode];
  const byWidth =
    mode === "mobile" ? Math.min(box.width - FRAME_PAD, PHONE_MAX_WIDTH) : box.width - FRAME_PAD;
  if (!fitHeight || box.height <= 0) {
    return mode === "mobile" ? PHONE_WIDTH : Math.max(280, box.width - FRAME_PAD);
  }
  const byHeight = ((box.height - FRAME_PAD - CAPTION_SPACE) * vp.width) / vp.height;
  return Math.max(200, Math.min(byWidth, byHeight));
}

/**
 * Vista previa en vivo dentro de un iframe del mismo origen: los breakpoints de
 * Tailwind responden al ancho real (375 px móvil, 1280 px escritorio), así que
 * lo que se ve es exactamente la página pública, escalada para caber al lado del editor.
 * Desde `md` llena el alto del contenedor (que debe tener alto definido).
 */
export function DevicePreview({
  mode,
  onModeChange,
  onDocument,
  label,
  children,
}: {
  mode: PreviewMode;
  onModeChange: (m: PreviewMode) => void;
  /** Entrega el document del iframe (para hacer scroll a una sección). */
  onDocument?: (doc: Document | null) => void;
  label: string;
  children: React.ReactNode;
}) {
  const vp = VIEWPORT[mode];
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ width: 560, height: 0 });
  const fitHeight = useMatchMedia(FIT_QUERY);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setBox({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const displayWidth = displayWidthFor(mode, box, fitHeight);
  const scale = displayWidth / vp.width;
  const displayHeight = vp.height * scale;

  return (
    <div className="flex min-w-0 flex-col gap-3 md:h-full md:min-h-0">
      <div
        className="flex shrink-0 items-center justify-center gap-2"
        role="group"
        aria-label="Tamaño de la vista previa"
      >
        <ModeButton
          active={mode === "mobile"}
          onClick={() => onModeChange("mobile")}
          icon={Smartphone}
        >
          Móvil
        </ModeButton>
        <ModeButton
          active={mode === "desktop"}
          onClick={() => onModeChange("desktop")}
          icon={Monitor}
        >
          Escritorio
        </ModeButton>
      </div>

      {/* Desde md el teléfono queda centrado en el alto disponible (no pegado arriba). */}
      <div
        ref={wrapRef}
        className="w-full md:flex md:min-h-0 md:flex-1 md:flex-col md:justify-center"
      >
        <div
          className={`mx-auto bg-black shadow-2xl ${mode === "mobile" ? "rounded-[2.6rem] p-2" : "rounded-xl p-2"}`}
          style={{ width: displayWidth + FRAME_PAD }}
        >
          <div
            className={`relative overflow-hidden bg-white ${mode === "mobile" ? "rounded-[2.1rem]" : "rounded-md"}`}
            style={{ width: displayWidth, height: displayHeight }}
          >
            <FramePortal
              key={mode}
              title={label}
              width={vp.width}
              height={vp.height}
              scale={scale}
              onDocument={onDocument}
            >
              {children}
            </FramePortal>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          En vivo · {vp.width} px · los enlaces no se abren aquí
        </p>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Monitor;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-xs px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 transition ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-background text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {children}
    </button>
  );
}

/** Copia hojas de estilo del documento padre (y las que se agreguen después, p. ej. fuentes). */
function mirrorStyles(target: Document): () => void {
  const isStyle = (n: Node): n is HTMLElement =>
    n.nodeType === Node.ELEMENT_NODE &&
    ((n as HTMLElement).tagName === "STYLE" ||
      ((n as HTMLElement).tagName === "LINK" && (n as HTMLLinkElement).rel === "stylesheet"));
  document.head.querySelectorAll("style, link[rel=stylesheet]").forEach((n) => {
    target.head.appendChild(n.cloneNode(true));
  });
  const mo = new MutationObserver((records) => {
    for (const r of records)
      r.addedNodes.forEach((n) => isStyle(n) && target.head.appendChild(n.cloneNode(true)));
  });
  mo.observe(document.head, { childList: true });
  return () => mo.disconnect();
}

function FramePortal({
  title,
  width,
  height,
  scale,
  onDocument,
  children,
}: {
  title: string;
  width: number;
  height: number;
  scale: number;
  onDocument?: (doc: Document | null) => void;
  children: React.ReactNode;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;
    doc.open();
    doc.write(
      '<!doctype html><html lang="es-CL"><head><meta charset="utf-8"></head><body></body></html>',
    );
    doc.close();
    const stop = mirrorStyles(doc);
    // Vista previa: los enlaces (wa.me, redes, anclas) no navegan ni abren pestañas.
    const blockLinks = (e: MouseEvent) => {
      // instanceof no sirve entre documentos (cada iframe tiene su propio Element).
      const target = e.target as Element | null;
      if (target?.closest?.("a[href]")) e.preventDefault();
    };
    const blockSubmit = (e: Event) => e.preventDefault();
    doc.addEventListener("click", blockLinks, true);
    doc.addEventListener("submit", blockSubmit, true);
    doc.documentElement.style.colorScheme = "light";
    doc.body.style.margin = "0";
    const root = doc.createElement("div");
    root.style.minHeight = "100vh";
    doc.body.appendChild(root);
    setMount(root);
    onDocument?.(doc);
    return () => {
      doc.removeEventListener("click", blockLinks, true);
      doc.removeEventListener("submit", blockSubmit, true);
      stop();
      onDocument?.(null);
      setMount(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <iframe
        ref={iframeRef}
        title={title}
        className="absolute left-0 top-0 border-0 bg-white"
        style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      />
      {mount && createPortal(children, mount)}
    </>
  );
}
