import { useEffect, useState } from "react";

/** Secciones plegables de la ficha. */
export const FICHA_SECTIONS = [
  "approvals",
  "upcoming",
  "health",
  "proposals",
  "reports",
  "monthPlan",
  "reviews",
  "about",
  "onboardingLink",
  "contract",
] as const;
export type FichaSectionId = (typeof FICHA_SECTIONS)[number];
export type FichaSectionState = Readonly<Record<FichaSectionId, boolean>>;

/** Lo esencial abierto; lo secundario plegado con su resumen en el encabezado. */
export const FICHA_SECTION_DEFAULTS: FichaSectionState = {
  approvals: true,
  upcoming: true,
  health: true,
  proposals: false,
  reports: false,
  monthPlan: false,
  reviews: false,
  about: false,
  onboardingLink: false,
  contract: false,
};

const STORAGE_PREFIX = "vb.ficha.sections.v1:";

/** Lee lo guardado y lo combina con los valores por defecto (ignora claves o valores raros). */
export function parseSectionState(raw: string | null): FichaSectionState {
  if (!raw) return FICHA_SECTION_DEFAULTS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return FICHA_SECTION_DEFAULTS;
    }
    const saved = parsed as Record<string, unknown>;
    return Object.fromEntries(
      FICHA_SECTIONS.map((id) => [
        id,
        typeof saved[id] === "boolean" ? saved[id] : FICHA_SECTION_DEFAULTS[id],
      ]),
    ) as FichaSectionState;
  } catch {
    return FICHA_SECTION_DEFAULTS;
  }
}

function readStored(userKey: string): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + userKey);
  } catch {
    return null;
  }
}

function writeStored(userKey: string, state: FichaSectionState): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + userKey, JSON.stringify(state));
  } catch {
    // Navegador sin almacenamiento (modo privado, bloqueado): se recuerda solo en esta visita.
  }
}

/**
 * Qué secciones de la ficha están abiertas, recordado por usuario en este
 * navegador. En SSR y antes de leer el almacenamiento se usan los valores por defecto.
 */
export function useFichaSections(userKey: string) {
  const [state, setState] = useState<FichaSectionState>(FICHA_SECTION_DEFAULTS);

  useEffect(() => {
    setState(parseSectionState(readStored(userKey)));
  }, [userKey]);

  const setOpen = (id: FichaSectionId, open: boolean) => {
    setState((prev) => {
      const next = { ...prev, [id]: open };
      writeStored(userKey, next);
      return next;
    });
  };

  return {
    isOpen: (id: FichaSectionId) => state[id],
    toggle: (id: FichaSectionId) => (open: boolean) => setOpen(id, open),
  };
}
