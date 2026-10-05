import { Ban, CheckCircle2, FileText, Snowflake, Target } from "lucide-react";
import { CompactStats } from "@/components/app";
import { COLD_STATE, convertedClientId } from "@/lib/prospects/schema";
import type { Prospect } from "./prospectsData";

/** Etapas "en juego" del embudo (antes de ganar). */
const IN_PLAY = new Set(["nuevo", "contactado", "respondio", "demo", "propuesta"]);

interface FunnelCounts {
  enJuego: number;
  propuesta: number;
  ganados: number;
  porConvertir: number;
  frios: number;
  bajas: number;
}

/** Cuenta prospectos por tramo del embudo (sin mutar la lista). */
function countFunnel(prospects: readonly Prospect[]): FunnelCounts {
  return prospects.reduce<FunnelCounts>(
    (acc, p) => ({
      enJuego: acc.enJuego + (IN_PLAY.has(p.estado) ? 1 : 0),
      propuesta: acc.propuesta + (p.estado === "propuesta" ? 1 : 0),
      ganados: acc.ganados + (p.estado === "ganado" ? 1 : 0),
      porConvertir: acc.porConvertir + (p.estado === "ganado" && !convertedClientId(p) ? 1 : 0),
      frios: acc.frios + (p.estado === COLD_STATE ? 1 : 0),
      bajas: acc.bajas + (p.estado === "baja" ? 1 : 0),
    }),
    { enJuego: 0, propuesta: 0, ganados: 0, porConvertir: 0, frios: 0, bajas: 0 },
  );
}

/** Franja con el embudo de un vistazo: en juego, propuestas, ganados, fríos y bajas. */
export function FunnelSummary({ prospects }: { prospects: readonly Prospect[] }) {
  const c = countFunnel(prospects);
  return (
    <CompactStats
      label="Embudo comercial"
      className="hidden shrink-0 sm:grid"
      items={[
        { key: "juego", label: "En juego", icon: Target, value: c.enJuego },
        { key: "propuesta", label: "Propuesta", icon: FileText, value: c.propuesta },
        {
          key: "ganados",
          label: "Ganados",
          icon: CheckCircle2,
          value: c.ganados,
          hint: c.porConvertir > 0 ? `${c.porConvertir} por convertir` : undefined,
        },
        { key: "frios", label: "Fríos", icon: Snowflake, value: c.frios },
        { key: "bajas", label: "No contactar", icon: Ban, value: c.bajas },
      ]}
    />
  );
}
