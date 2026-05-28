// Renders each page of a PDF to a JPEG File using pdfjs-dist.
// Runs entirely in the browser.
import * as pdfjsLib from "pdfjs-dist";
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

let workerPort: Worker | null = null;

const ensurePdfWorker = () => {
  if (!workerPort) {
    workerPort = new PdfWorker({ type: "module" });
    pdfjsLib.GlobalWorkerOptions.workerPort = workerPort;
  }
};

export async function pdfToImageFiles(
  file: File,
  opts: { scale?: number; quality?: number; baseName?: string } = {}
): Promise<File[]> {
  const scale = opts.scale ?? 2;
  const quality = opts.quality ?? 0.9;
  const baseName = (opts.baseName ?? file.name.replace(/\.pdf$/i, "")) || "page";
  ensurePdfWorker();

  const buf = await file.arrayBuffer();
  if (!buf || buf.byteLength === 0) {
    throw new Error("El archivo PDF está vacío");
  }

  let pdf: any;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: buf,
      useSystemFonts: true,
      disableAutoFetch: true,
      disableStream: true,
    } as any);
    pdf = await loadingTask.promise;
  } catch (e: any) {
    console.error("[pdfToImages] getDocument failed", e);
    throw new Error(`No se pudo leer el PDF: ${e?.message ?? e}`);
  }

  const numPages = pdf?.numPages ?? 0;
  console.log("[pdfToImages]", file.name, "size=", buf.byteLength, "numPages=", numPages);
  if (!numPages || numPages < 1) {
    throw new Error("El PDF no contiene páginas legibles");
  }

  const files: File[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no disponible");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    try {
      await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    } catch (e: any) {
      console.error(`[pdfToImages] render page ${i} failed`, e);
      throw new Error(`Error al renderizar página ${i}: ${e?.message ?? e}`);
    }

    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob falló"))),
        "image/jpeg",
        quality
      )
    );
    files.push(
      new File([blob], `${baseName}-${String(i).padStart(2, "0")}.jpg`, {
        type: "image/jpeg",
      })
    );
  }
  return files;
}
