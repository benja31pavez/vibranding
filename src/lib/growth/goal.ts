/**
 * Avance hacia la meta de MRR (cálculo puro, sin red). Lo revisa
 * scripts/check-growth.mjs.
 */

/** Mes límite para llegar a META_MRR_CLP ("YYYY-MM", inclusive). */
export const META_DEADLINE_MONTH = "2027-04";
/** Meses que muestra la tendencia (incluido el actual). */
export const TREND_MONTHS = 12;

export interface GoalInput {
  mrr: number;
  goal: number;
  /** Clientes que hoy aportan MRR (suscripción o client_billing). */
  recurringClients: number;
  /** Ticket a usar si aún no hay clientes recurrentes (p. ej. el plan mensual más barato). */
  fallbackTicket: number;
  /** Mes actual en Chile, "YYYY-MM". */
  currentMonth: string;
  deadlineMonth?: string;
}

export interface GoalSummary {
  mrr: number;
  goal: number;
  gap: number;
  /** 0-100 (tope 100). */
  progressPct: number;
  monthsRemaining: number;
  avgTicket: number;
  /** true si el ticket sale del plan de respaldo porque no hay clientes recurrentes. */
  ticketIsFallback: boolean;
  clientsNeeded: number;
  /** Clientes nuevos por mes para llegar a tiempo (sin contar bajas). */
  clientsPerMonth: number;
}

function monthIndex(ym: string): number {
  const match = /^(\d{4})-(\d{2})/.exec(ym);
  if (!match) throw new Error(`Mes inválido: ${ym}`);
  return Number(match[1]) * 12 + (Number(match[2]) - 1);
}

function indexToMonth(index: number): string {
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Meses completos que quedan después del actual hasta el mes límite (inclusive). Nunca negativo. */
export function monthsRemaining(currentMonth: string, deadlineMonth: string = META_DEADLINE_MONTH): number {
  return Math.max(0, monthIndex(deadlineMonth) - monthIndex(currentMonth));
}

/** Lista de meses "YYYY-MM" terminando en `currentMonth`, del más antiguo al más nuevo. */
export function lastMonths(currentMonth: string, count: number = TREND_MONTHS): string[] {
  const end = monthIndex(currentMonth);
  return Array.from({ length: count }, (_, i) => indexToMonth(end - count + 1 + i));
}

export function computeGoal(input: GoalInput): GoalSummary {
  const { mrr, goal, recurringClients, fallbackTicket, currentMonth } = input;
  const gap = Math.max(0, goal - mrr);
  const ticketIsFallback = recurringClients <= 0 || mrr <= 0;
  const avgTicket = ticketIsFallback ? fallbackTicket : Math.round(mrr / recurringClients);
  const clientsNeeded = gap > 0 && avgTicket > 0 ? Math.ceil(gap / avgTicket) : 0;
  const months = monthsRemaining(currentMonth, input.deadlineMonth);
  return {
    mrr,
    goal,
    gap,
    progressPct: goal > 0 ? Math.min(100, Math.round((mrr / goal) * 1000) / 10) : 0,
    monthsRemaining: months,
    avgTicket,
    ticketIsFallback,
    clientsNeeded,
    clientsPerMonth: months > 0 ? Math.ceil(clientsNeeded / months) : clientsNeeded,
  };
}

export interface RecurringPayment {
  amount: number | string;
  currency: string | null;
  /** Mes del pago en Chile, "YYYY-MM". */
  month: string;
}

export interface TrendPoint {
  month: string;
  collected: number;
}

/**
 * Cobro recurrente por mes: suma de pagos mensuales pagados (solo CLP; los
 * registros antiguos en otra moneda no se suman). Meses sin pagos quedan en 0.
 */
export function monthlyTrend(payments: readonly RecurringPayment[], months: readonly string[]): TrendPoint[] {
  const totals = new Map<string, number>(months.map((m) => [m, 0]));
  for (const p of payments) {
    if ((p.currency ?? "CLP").toUpperCase() !== "CLP") continue;
    const prev = totals.get(p.month);
    const amount = Number(p.amount);
    if (prev === undefined || !Number.isFinite(amount)) continue;
    totals.set(p.month, prev + amount);
  }
  return months.map((month) => ({ month, collected: totals.get(month) ?? 0 }));
}
