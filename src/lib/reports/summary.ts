/**
 * Resumen en lenguaje simple del reporte mensual. Plantilla determinística
 * (sin IA): mismas cifras → mismo texto. Elige 3 conclusiones priorizando las
 * variaciones más grandes contra el mes anterior.
 */
import { fmtInt, fmtMoney, fmtPct, relativeChange } from "./format";
import type { Metric, MonthlyReportData } from "./types";

export const SUMMARY_POINTS = 3;
/** Bajo esta base, un % confunde (1 → 3 = +200%): se usan cifras absolutas. */
const MIN_BASE_FOR_PCT = 5;
/** Variaciones menores se consideran "estables". */
const STABLE_THRESHOLD = 0.05;

interface Phrase {
  /** Sujeto + verbo en plural/singular: "Tus visitas a la web". */
  subject: string;
  /** Formatea la cifra ("1.230 visitas"). */
  amount: (n: number) => string;
  /** Cifra corta para "(de X a Y)"; por defecto el número solo. */
  short?: (n: number) => string;
  /** true si bajar es bueno (costos). */
  lowerIsBetter?: boolean;
}

interface Candidate {
  text: string;
  /** Mayor = más relevante. */
  score: number;
}

function compare(metric: Metric | null | undefined, phrase: Phrase): Candidate | null {
  if (!metric) return null;
  const { value, previous } = metric;
  if (value <= 0 && (previous ?? 0) <= 0) return null;

  if (previous == null) return null;
  const ratio = relativeChange(value, previous);
  if (ratio == null || previous < MIN_BASE_FOR_PCT) {
    if (value === previous) return null;
    return {
      text: `${phrase.subject}: ${phrase.amount(value)} este mes (el mes anterior: ${phrase.amount(previous)}).`,
      score: 0.5,
    };
  }
  if (Math.abs(ratio) < STABLE_THRESHOLD) {
    return {
      text: `${phrase.subject} se mantuvieron estables: ${phrase.amount(value)} este mes.`,
      score: 0.1,
    };
  }
  const up = ratio > 0;
  const good = phrase.lowerIsBetter ? !up : up;
  const verb = up ? "subieron" : "bajaron";
  const short = phrase.short ?? fmtInt;
  return {
    text: `${phrase.subject} ${verb} ${fmtPct(ratio)} (de ${short(previous)} a ${short(value)}).`,
    // Las buenas noticias van primero ante variaciones parecidas.
    score: 1 + Math.abs(ratio) + (good ? 0.01 : 0),
  };
}

const plural = (n: number, one: string, many: string) =>
  `${fmtInt(n)} ${Math.round(n) === 1 ? one : many}`;

function candidates(data: MonthlyReportData): Candidate[] {
  const out: (Candidate | null)[] = [];
  const meta = data.meta_ads;
  const google = data.google_ads;

  out.push(
    compare(data.landing?.visits, {
      subject: "Tus visitas a la web",
      amount: (n) => plural(n, "visita", "visitas"),
    }),
    compare(data.landing?.contacts, {
      subject: "Los clicks para contactarte desde tu web",
      amount: (n) => plural(n, "click", "clicks"),
    }),
    compare(data.leads?.total, {
      subject: "Tus contactos nuevos",
      amount: (n) => plural(n, "contacto", "contactos"),
    }),
    compare(data.bookings?.total, {
      subject: "Tus reservas",
      amount: (n) => plural(n, "reserva", "reservas"),
    }),
    compare(data.instagram?.post_views, {
      subject: "Las visualizaciones de tus publicaciones en Instagram",
      amount: (n) => plural(n, "visualización", "visualizaciones"),
    }),
    compare(data.instagram?.interactions, {
      subject: "Las interacciones con tus publicaciones",
      amount: (n) => plural(n, "interacción", "interacciones"),
    }),
    compare(meta?.conversions, {
      subject: "Las conversaciones generadas por tus anuncios en Meta",
      amount: (n) => plural(n, "conversación", "conversaciones"),
    }),
    compare(meta?.cpa, {
      subject: "Los costos por conversación en Meta",
      amount: (n) => fmtMoney(n, meta?.currency),
      short: (n) => fmtMoney(n, meta?.currency),
      lowerIsBetter: true,
    }),
    compare(google?.conversions, {
      subject: "Las conversiones de tus anuncios en Google",
      amount: (n) => plural(n, "conversión", "conversiones"),
    }),
  );

  const followers = data.instagram?.followers;
  if (followers?.net_change != null && followers.net_change !== 0) {
    const n = Math.abs(followers.net_change);
    out.push({
      text:
        followers.net_change > 0
          ? `Ganaste ${plural(n, "seguidor", "seguidores")} en Instagram; ahora tienes ${fmtInt(followers.value)}.`
          : `Tu cuenta de Instagram perdió ${plural(n, "seguidor", "seguidores")}; ahora tienes ${fmtInt(followers.value)}.`,
      score: 0.6,
    });
  }

  // Hechos sin comparación (relleno cuando no hay mes anterior).
  if (data.deliverables && data.deliverables.completed > 0) {
    out.push({
      text: `Completamos ${plural(data.deliverables.completed, "entregable", "entregables")} para tu marca.`,
      score: 0.3,
    });
  }
  if (data.leads && data.leads.total.previous == null && data.leads.total.value > 0) {
    out.push({
      text: `Recibiste ${plural(data.leads.total.value, "contacto nuevo", "contactos nuevos")}.`,
      score: 0.2,
    });
  }
  if (data.landing && data.landing.visits.previous == null && data.landing.visits.value > 0) {
    out.push({
      text: `Tu web recibió ${plural(data.landing.visits.value, "visita", "visitas")}.`,
      score: 0.2,
    });
  }
  if (meta && meta.spend.value > 0) {
    out.push({
      text: `Invertimos ${fmtMoney(meta.spend.value, meta.currency)} en anuncios de Meta.`,
      score: 0.15,
    });
  }

  return out.filter((c): c is Candidate => c !== null);
}

/** 3 conclusiones, una por línea. */
export function buildAutoSummary(data: MonthlyReportData): string {
  // sort es estable: a igual puntaje se respeta el orden fijo de arriba.
  const picked = candidates(data)
    .sort((a, b) => b.score - a.score)
    .slice(0, SUMMARY_POINTS)
    .map((c) => c.text);
  if (picked.length === 0) {
    return "Este mes todavía no tenemos datos suficientes para sacar conclusiones. Seguimos midiendo.";
  }
  return picked.join("\n");
}
