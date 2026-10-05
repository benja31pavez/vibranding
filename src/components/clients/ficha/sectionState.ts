import { useCallback, useEffect, useState } from "react";

/** Secciones plegables de la ficha. */
export const FICHA_SECTIONS = [
  "approvals",
  "upcoming",
  "health",
  "proposals",
  "reports",
  "monthPlan",
  "about",
  "billing",
  "contract",
  "access",
  "onboardingLink",
  "onboarding",
  "reviews",
] as const;
export type FichaSectionId = (typeof FICHA_SECTIONS)[number];
export type FichaSectionState = Readonly<Record<FichaSectionId, boolean>>;
/** Lo que el usuario abrió o plegó a mano (lo demás sigue los valores por defecto). */
export type FichaSectionOverrides = Readonly<Partial<Record<FichaSectionId, boolean>>>;

/** Todo abierto con su contenido clave; solo Reseñas parte plegada. */
export const FICHA_SECTION_DEFAULTS: FichaSectionState = {
  approvals: true,
  upcoming: true,
  health: true,
  proposals: true,
  reports: true,
  monthPlan: true,
  about: true,
  billing: true,
  contract: true,
  access: true,
  onboardingLink: true,
  onboarding: true,
  reviews: false,
};

/**
 * Si una columna no cabe en la pantalla, se pliegan solas en este orden (lo
 * primero es lo menos urgente). Pendientes y Próximo contenido nunca: sus
 * listas se adaptan al alto con `FitList`.
 */
export const FICHA_AUTO_COLLAPSE_ORDER: readonly FichaSectionId[] = [
  "about",
  "onboarding",
  "onboardingLink",
  "monthPlan",
  "access",
  "reports",
  "contract",
  "proposals",
  "health",
  "billing",
];

/** v2: nuevos valores por defecto; lo guardado con v1 se ignora (una sola vez). */
const STORAGE_PREFIX = "vb.ficha.sections.v2:";

export function isSectionId(value: string | undefined): value is FichaSectionId {
  return (FICHA_SECTIONS as readonly string[]).includes(value ?? "");
}

/** Lee las elecciones guardadas (ignora claves o valores raros). */
export function parseSectionOverrides(raw: string | null): FichaSectionOverrides {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([id, value]) => isSectionId(id) && typeof value === "boolean",
      ),
    ) as FichaSectionOverrides;
  } catch {
    return {};
  }
}

function readStored(userKey: string): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + userKey);
  } catch {
    return null;
  }
}

function writeStored(userKey: string, overrides: FichaSectionOverrides): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + userKey, JSON.stringify(overrides));
  } catch {
    // Navegador sin almacenamiento (modo privado, bloqueado): se recuerda solo en esta visita.
  }
}

/** Lo que eligió el usuario manda; si no la tocó, el defecto salvo que se haya plegado por espacio. */
export function resolveSectionOpen(
  id: FichaSectionId,
  overrides: FichaSectionOverrides,
  autoCollapsed: ReadonlySet<FichaSectionId>,
): boolean {
  return overrides[id] ?? (FICHA_SECTION_DEFAULTS[id] && !autoCollapsed.has(id));
}

export interface FitCandidate {
  id: FichaSectionId;
  /** Alto que se libera al plegarla (cuerpo de la sección). */
  savings: number;
}

/**
 * Qué plegar para quitar `excess` px de una columna: en orden de prioridad,
 * solo candidatas que se pueden plegar solas, hasta liberar lo suficiente.
 * Si ni plegando todo alcanza, pliega todas las candidatas.
 */
export function planCollapse(
  excess: number,
  candidates: readonly FitCandidate[],
  isAutoCollapsible: (id: FichaSectionId) => boolean,
): FichaSectionId[] {
  const plan: FichaSectionId[] = [];
  let freed = 0;
  for (const id of FICHA_AUTO_COLLAPSE_ORDER) {
    if (freed >= excess) break;
    const candidate = candidates.find((c) => c.id === id);
    if (!candidate || !isAutoCollapsible(id)) continue;
    plan.push(id);
    freed += candidate.savings;
  }
  return plan;
}

const EMPTY_SET: ReadonlySet<FichaSectionId> = new Set();

/**
 * Qué secciones de la ficha están abiertas. Las elecciones del usuario se
 * recuerdan por usuario en este navegador; lo que no tocó sigue los valores
 * por defecto, salvo lo que la ficha plegó sola porque no cabía (eso no se guarda).
 */
export function useFichaSections(userKey: string) {
  const [overrides, setOverrides] = useState<FichaSectionOverrides>({});
  const [autoCollapsed, setAutoCollapsed] = useState<ReadonlySet<FichaSectionId>>(EMPTY_SET);

  useEffect(() => {
    setOverrides(parseSectionOverrides(readStored(userKey)));
  }, [userKey]);

  const isOpen = (id: FichaSectionId) => resolveSectionOpen(id, overrides, autoCollapsed);

  const toggle = (id: FichaSectionId) => (open: boolean) => {
    setOverrides((prev) => {
      const next = { ...prev, [id]: open };
      writeStored(userKey, next);
      return next;
    });
  };

  /** Abierta y sin elección del usuario: se puede plegar sola si no cabe. */
  const isAutoCollapsible = (id: FichaSectionId) =>
    overrides[id] === undefined && resolveSectionOpen(id, overrides, autoCollapsed);

  const autoCollapse = useCallback((ids: readonly FichaSectionId[]) => {
    if (ids.length > 0) setAutoCollapsed(new Set(ids));
  }, []);

  /** Vuelve a partir de todo abierto (p. ej. al cambiar el alto de la ventana). */
  const resetAutoCollapse = useCallback(() => {
    setAutoCollapsed((prev) => (prev.size === 0 ? prev : EMPTY_SET));
  }, []);

  return {
    isOpen,
    toggle,
    isAutoCollapsible,
    autoCollapse,
    resetAutoCollapse,
    autoCollapsedCount: autoCollapsed.size,
  };
}

export type FichaSections = ReturnType<typeof useFichaSections>;
