/**
 * Seguimiento sugerido "pedir_resena" para "Inicio": clientes contentos
 * (salud "bien", activos ≥ 60 días, sin cobros vencidos) a los que no se les
 * pidió reseña en los últimos 90 días. Puro: el llamador entrega los datos.
 * Nunca envía nada; solo sugiere.
 */
import {
  REVIEW_MIN_ACTIVE_DAYS,
  activeDays,
  isGoodMomentForReview,
  normalizeReviewUrl,
  type ReviewAskedMap,
} from "@/lib/reviews/requestReview";
import { finalize, whatsappDigits } from "./rules";
import type { Followup } from "./types";

export interface ReviewCandidate {
  id: string;
  name: string;
  status: string;
  created_at: string;
  started_at: string | null;
  /** Teléfono de la ficha de onboarding (client_intake.contacto_telefono). */
  phone: string | null;
}

export interface ReviewHealth {
  level: string;
  reasonCodes: readonly string[];
}

export interface ReviewSuggestionSources {
  candidates: readonly ReviewCandidate[];
  /** Salud por cliente (sin entrada = no se sugiere). */
  health: ReadonlyMap<string, ReviewHealth>;
  /** Clientes con algún cobro vencido. */
  overdueClientIds: ReadonlySet<string>;
  asked: ReviewAskedMap;
  today: string;
  googleReviewUrl: string | null;
}

export function reviewFollowups(src: ReviewSuggestionSources): Followup[] {
  const url = normalizeReviewUrl(src.googleReviewUrl);
  return src.candidates.flatMap((c) => {
    const health = src.health.get(c.id);
    const startedAt = c.started_at ?? c.created_at;
    const ok = isGoodMomentForReview({
      clientStatus: c.status,
      startedAt,
      healthLevel: health?.level,
      healthReasonCodes: health?.reasonCodes,
      hasOverduePayments: src.overdueClientIds.has(c.id),
      lastAskedYmd: src.asked[c.id],
      today: src.today,
    });
    if (!ok) return [];
    const days = activeDays(startedAt, src.today) ?? REVIEW_MIN_ACTIVE_DAYS;
    return [
      finalize({
        refId: c.id,
        ageDays: 0,
        kind: "pedir_resena",
        reason: `Cliente contento hace ${days} días: buen momento para pedir reseña o testimonio.`,
        businessName: c.name,
        clientId: c.id,
        prospectId: null,
        target: { screen: "client", clientId: c.id },
        link: url ? { kind: "absolute", url } : null,
        template: {
          kind: "pedir_resena",
          businessName: c.name,
          offerName: null,
          amountLabel: null,
          dateLabel: null,
          periodLabel: null,
        },
        whatsappPhone: c.phone && whatsappDigits(c.phone) ? c.phone : null,
        recordsProspectContact: false,
      }),
    ];
  });
}
