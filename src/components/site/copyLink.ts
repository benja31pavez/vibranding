import { toast } from "sonner";

/** Copia el link público con aviso; si aún es borrador, lo advierte. */
export async function copyPublicLink(url: string, published = true): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    toast.success(
      published ? "Link copiado" : "Link copiado (aún es borrador: publícalo para que funcione)",
    );
  } catch {
    toast.error("No se pudo copiar. Selecciona el link y cópialo a mano.");
  }
}
