/**
 * Ponerse al día: cuando una suscripción tiene varios meses atrasados, el
 * cobro recurrente crea como máximo MAX_CATCH_UP_PERIODS cobros por corrida
 * (no 12 cobros retroactivos de golpe) y lo informa. Puro, probado en
 * scripts/check-billing-catch-up.mjs.
 */

/** Tope de períodos atrasados que se cobran en una sola corrida. */
export const MAX_CATCH_UP_PERIODS = 2;

export const CATCH_UP_LOG_TAG = "[billing][ponerse_al_dia]";

export interface CatchUpInput {
  subscriptionId: string;
  clientId: string;
  created: readonly string[];
  nextChargeDate: string | null;
  error?: string;
}

export interface CatchUpNotice {
  subscriptionId: string;
  clientId: string;
  /** Períodos (YYYY-MM-01) creados en esta corrida. */
  created: string[];
  /** true si quedan períodos atrasados para las próximas corridas. */
  pending: boolean;
  nextChargeDate: string | null;
}

/** Hay que seguir cobrando en esta corrida (aún atrasada y bajo el tope). */
export function shouldContinueCatchUp(iteration: number, current: string, today: string): boolean {
  return iteration < MAX_CATCH_UP_PERIODS && current <= today;
}

/**
 * Suscripciones que crearon más de un cobro o que siguen atrasadas tras la
 * corrida (para revisar a mano y avisar al cliente).
 */
export function catchUpNotices(results: readonly CatchUpInput[], today: string): CatchUpNotice[] {
  return results.flatMap((r) => {
    const pending = !r.error && r.nextChargeDate !== null && r.nextChargeDate <= today;
    if (r.created.length <= 1 && !pending) return [];
    return [
      {
        subscriptionId: r.subscriptionId,
        clientId: r.clientId,
        created: [...r.created],
        pending,
        nextChargeDate: r.nextChargeDate,
      },
    ];
  });
}
