import type { PanelFile } from "@/lib/client-panel/model";

/** ¿Se abre en el visor? (los reportes se abren en otra pestaña; Office se descarga). */
export function isPanelViewable(file: PanelFile): boolean {
  return file.media !== "page" && file.media !== "file" && file.urls.length > 0;
}
