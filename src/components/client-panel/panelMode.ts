import { createContext, useContext } from "react";
import { useSearch } from "@tanstack/react-router";

/**
 * Modo del panel del cliente:
 *  - preview = null: el usuario cliente (su cliente sale de user_client_id()).
 *  - preview = UUID: vista previa de la agencia ("Ver como cliente"). Todo es
 *    solo lectura y el servidor valida el rol en la org de ese cliente.
 *
 * Este es el ÚNICO archivo del panel que lee la URL, y solo lee `preview`
 * (ya filtrado por parsePanelSearch en la ruta /mi).
 */
export interface PanelMode {
  preview: string | null;
}

/** `?preview=` de /mi (null si no viene). */
export function usePreviewParam(): string | null {
  return useSearch({ from: "/mi", select: (s) => s.preview ?? null });
}

const PanelModeContext = createContext<PanelMode>({ preview: null });

export const PanelModeProvider = PanelModeContext.Provider;

export function usePanelMode(): PanelMode {
  return useContext(PanelModeContext);
}

/** Parámetros de búsqueda que conservan la vista previa al navegar dentro de /mi. */
export function previewSearch(preview: string | null): { preview?: string } {
  return preview ? { preview } : {};
}
