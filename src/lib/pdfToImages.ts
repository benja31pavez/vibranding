// Renders each page of a PDF to a JPEG File using pdfjs-dist.
// Runs entirely in the browser.
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite handles ?url import
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function pdfToImageFiles(
  file: File,
  opts: { scale?: number; quality?: number; baseName?: string } = {}
): Promise<File[]> {
  const scale = opts.scale ?? 2;
  const quality = opts.quality ?? 0.9;
  const baseName = (opts.baseName ?? file.name.replace(/\.pdf$/i, "")) || "page";

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const files: File[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no disponible");
    // White background for transparent PDFs
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

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
