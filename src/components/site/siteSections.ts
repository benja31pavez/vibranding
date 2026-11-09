/**
 * Subsecciones de la pantalla "Sitio" del cliente y su correspondencia con las vistas
 * internas de los editores de landing y multienlace. Puro: sin React.
 */

export type SitioTab = "resumen" | "secciones" | "dominio" | "analitica";
export const SITIO_TABS: readonly SitioTab[] = ["resumen", "secciones", "dominio", "analitica"];
export function isSitioTab(v: unknown): v is SitioTab {
  return typeof v === "string" && (SITIO_TABS as readonly string[]).includes(v);
}

/** Las tres subsecciones que muestran un editor (todas menos Resumen). */
export type SiteSection = Exclude<SitioTab, "resumen">;

/** Página del sitio que se edita: la landing o el multienlace. */
export type SitioPagina = "landing" | "multienlace";
export function isSitioPagina(v: unknown): v is SitioPagina {
  return v === "landing" || v === "multienlace";
}

export type LandingViewTab = "editar" | "ajustes" | "mensajes" | "metricas";
export type MultilinkViewTab = "editar" | "compartir" | "metricas";

/** Vista interna del editor de landing para cada subsección. */
export const LANDING_VIEW_OF_SECTION: Readonly<Record<SiteSection, LandingViewTab>> = {
  secciones: "editar",
  dominio: "ajustes",
  analitica: "metricas",
};

/** Subsección que corresponde a cada vista del editor de landing (Mensajes va con Analítica). */
export const SECTION_OF_LANDING_VIEW: Readonly<Record<LandingViewTab, SiteSection>> = {
  editar: "secciones",
  ajustes: "dominio",
  mensajes: "analitica",
  metricas: "analitica",
};

/** Vista interna del editor de multienlace para cada subsección. */
export const MULTILINK_VIEW_OF_SECTION: Readonly<Record<SiteSection, MultilinkViewTab>> = {
  secciones: "editar",
  dominio: "compartir",
  analitica: "metricas",
};
