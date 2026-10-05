import type { StageKey } from "@/lib/delivery/planStages";
import type { TeamMemberKey } from "@/lib/delivery/team";

/**
 * Tono (hue OKLCH) de la carpeta de cada etapa y de cada persona. Siempre el mismo
 * por etapa, para que se reconozca de un cliente a otro. Se evita el rojo puro,
 * reservado para lo atrasado.
 */
export const STAGE_HUE: Readonly<Record<StageKey, number>> = {
  estrategia: 255,
  branding: 330,
  diseno: 305,
  planificacion: 200,
  contenido: 165,
  ads: 55,
  landing: 285,
  chatbot: 190,
  optimizacion: 135,
  reporte: 85,
  entrega: 230,
};

export const MEMBER_HUE: Readonly<Record<TeamMemberKey, number>> = {
  antonia: 330,
  benjamin: 255,
};
