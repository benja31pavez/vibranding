// Renders each page of a PDF to a JPEG File using pdfjs-dist.
// Runs entirely in the browser.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export async function pdfToImageFiles(
  file: File,
  opts: { scale?: number; quality?: number; baseName?: string } = {}
): Promise<File[]> {
  const scale = opts.scale ?? 2;
  const quality = opts.quality ?? 0.9;
  const baseName = (opts.baseName ?? file.name.replace(/\.pdf$/i, "")) || "page";

  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.byteLength === 0) {
    throw new Error("El archivo PDF está vacío");
  }
  const header = new TextDecoder("ascii").decode(bytes.slice(0, 8));
  if (!header.includes("%PDF")) {
    throw new Error("El archivo seleccionado no parece ser un PDF válido");
  }

  let pdf: any;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: bytes,
      useSystemFonts: true,
      disableAutoFetch: true,
      disableStream: true,
      useWasm: false,
      isOffscreenCanvasSupported: false,
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
