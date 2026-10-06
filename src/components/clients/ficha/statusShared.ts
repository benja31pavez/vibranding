/** Constantes compartidas por la franja de estado de la gestión y la ficha del cliente. */
import type { AdsBillingState } from "@/lib/ads-billing/combined";

/** Planes que incluyen gestión de campañas en Meta Ads. */
export const PLANS_WITH_ADS: readonly string[] = ["crecimiento"];

/** Del peor al mejor estado de pago de pauta. */
export const ADS_STATE_RANK: Readonly<Record<AdsBillingState, number>> = {
  rechazado: 0,
  pendiente: 1,
  verificado: 2,
  sin_cuenta: 3,
};
