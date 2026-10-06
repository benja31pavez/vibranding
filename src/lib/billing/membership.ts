/**
 * Membresía autogestionada (decisión de Benja, 2026-10-06). Módulo puro: sin
 * red ni Supabase, para poder probarlo (`npm run check:membership`).
 *
 *  - El cliente elige y paga su plan en la plataforma (Flow). Precio fijo de
 *    `plans.ts`; nunca a medida.
 *  - Cada pago de un plan mensual cubre UN mes, del día de pago al mismo día del
 *    mes siguiente (ambos incluidos). No hay cobro automático: para seguir, el
 *    cliente renueva. Marca + Web es pago único (su período cubre el mes del
 *    proyecto).
 *  - Sin permanencia, sin cambio de plan durante el período pagado, sin pausas
 *    y sin devoluciones.
 *  - El estado comercial se DERIVA de los pagos confirmados (no se edita).
 *
 * El mismo cálculo vive en SQL (`public.client_membership`, migración
 * 20261012002500): si cambias una regla aquí, cámbiala también allá.
 */
import { addOneMonth } from "./dates";
import { PLANS, PUBLIC_PLANS, findPlan, type Plan, type PlanKey } from "@/lib/pricing/plans";

/** Días desde el primer pago en que se muestra la insignia "Onboarding". */
export const ONBOARDING_DAYS = 7;
/** Días antes del fin del período desde los que el cliente está "Por renovar". */
export const RENEW_WINDOW_DAYS = 5;
/** Días antes del fin del período en que sale el correo de seguimiento. */
export const FOLLOWUP_DAYS_BEFORE_END = 3;

export type MembershipState = "sin_plan" | "activo" | "por_renovar" | "finalizado";

export const MEMBERSHIP_STATE_LABEL: Readonly<Record<MembershipState, string>> = {
  sin_plan: "Sin plan vigente",
  activo: "Activo",
  por_renovar: "Por renovar",
  finalizado: "Finalizado",
};

/** Pago de un plan, como lo guarda `payments` (solo lo que importa aquí). */
export interface PlanPayment {
  status: string;
  plan_key: string | null;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
}

export interface Membership {
  state: MembershipState;
  /** Primeros ONBOARDING_DAYS días desde el primer pago (el cliente sigue Activo). */
  onboarding: boolean;
  /** Plan del período vigente o, si terminó, del último período pagado. */
  planKey: PlanKey | null;
  /** Período vigente (YYYY-MM-DD, ambos incluidos); si terminó, el último pagado. */
  periodStart: string | null;
  periodEnd: string | null;
  /** Último día cubierto, contando renovaciones ya pagadas. */
  coveredUntil: string | null;
  /** Días que quedan hasta `coveredUntil` (0 = último día). */
  daysLeft: number | null;
  /** Ya pagó la renovación del período siguiente. */
  renewed: boolean;
  /** Fecha del primer pago confirmado de un plan. */
  clientSince: string | null;
  /** Ya trabajó con nosotros y su período terminó: puede elegir Mantención. */
  formerClient: boolean;
}

const DAY_MS = 86_400_000;

function toDay(iso: string): string {
  return iso.slice(0, 10);
}

/** Días de `from` a `to` (YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${toDay(to)}T12:00:00Z`) - Date.parse(`${toDay(from)}T12:00:00Z`)) / DAY_MS,
  );
}

/**
 * Período que cubre un pago confirmado: parte el día de pago o, si aún hay un
 * período vigente, encadena desde su fin (renovación anticipada). Dura un mes:
 * 6-oct → 6-nov; 31-ene → 28/29-feb (igual que `date + interval '1 month'`).
 */
export function nextPeriod(
  paidAt: string,
  previousEnd: string | null,
): { start: string; end: string } {
  const paid = toDay(paidAt);
  const start = previousEnd && toDay(previousEnd) > paid ? toDay(previousEnd) : paid;
  return { start, end: addOneMonth(start) };
}

interface Period {
  planKey: PlanKey;
  start: string;
  end: string;
  paidAt: string;
}

function periodsOf(payments: readonly PlanPayment[]): Period[] {
  return payments.flatMap((p) => {
    const plan = findPlan(p.plan_key);
    if (p.status !== "paid" || !plan || !p.period_start || !p.period_end) return [];
    const start = toDay(p.period_start);
    return [
      {
        planKey: plan.key,
        start,
        end: toDay(p.period_end),
        paidAt: toDay(p.paid_at ?? start),
      },
    ];
  });
}

const EMPTY: Membership = {
  state: "sin_plan",
  onboarding: false,
  planKey: null,
  periodStart: null,
  periodEnd: null,
  coveredUntil: null,
  daysLeft: null,
  renewed: false,
  clientSince: null,
  formerClient: false,
};

/** Estado comercial derivado de los pagos de planes confirmados, a la fecha `today`. */
export function deriveMembership(payments: readonly PlanPayment[], today: string): Membership {
  const day = toDay(today);
  const periods = periodsOf(payments);
  if (periods.length === 0) return EMPTY;

  const clientSince = periods.map((p) => p.paidAt).sort()[0];
  const byEnd = [...periods].sort((a, b) => b.end.localeCompare(a.end));
  const current = byEnd.find((p) => p.start <= day && day <= p.end) ?? null;

  if (!current) {
    // Ex cliente: se informa el último período pagado (ya terminado).
    return {
      ...EMPTY,
      state: "finalizado",
      planKey: byEnd[0].planKey,
      periodStart: byEnd[0].start,
      periodEnd: byEnd[0].end,
      clientSince,
      formerClient: true,
    };
  }

  const coveredUntil = byEnd[0].end;
  const daysLeft = daysBetween(day, coveredUntil);
  return {
    state: daysLeft <= RENEW_WINDOW_DAYS ? "por_renovar" : "activo",
    onboarding: daysBetween(clientSince, day) < ONBOARDING_DAYS,
    planKey: current.planKey,
    periodStart: current.start,
    periodEnd: current.end,
    coveredUntil,
    daysLeft,
    renewed: coveredUntil > current.end,
    clientSince,
    formerClient: false,
  };
}

/** true si la membresía cuenta como cliente activo (Activo o Por renovar). */
export function isActiveMembership(m: Pick<Membership, "state">): boolean {
  return m.state === "activo" || m.state === "por_renovar";
}

/** MRR neto (sin IVA) que aporta el cliente: el precio del plan mensual vigente. */
export function membershipMrr(m: Pick<Membership, "state" | "planKey">): number {
  const plan = findPlan(m.planKey);
  return isActiveMembership(m) && plan?.billing === "monthly" ? plan.netPrice : 0;
}

/**
 * Planes que el cliente puede pagar hoy:
 *  - Sin plan: los públicos (Mantención nunca).
 *  - Activo: ninguno (no se cambia de plan durante el período pagado).
 *  - Por renovar: el mismo plan mensual; si viene de Marca + Web, un plan mensual público.
 *  - Finalizado (ex cliente): cualquiera, incluida Mantención.
 */
export function purchasablePlans(m: Membership): readonly Plan[] {
  if (m.state === "sin_plan") return PUBLIC_PLANS;
  if (m.state === "activo") return [];
  if (m.state === "finalizado") return PLANS;
  const current = findPlan(m.planKey);
  if (current?.billing === "monthly") return [current];
  return PUBLIC_PLANS.filter((p) => p.billing === "monthly");
}

export function canPurchase(m: Membership, planKey: string): boolean {
  return purchasablePlans(m).some((p) => p.key === planKey);
}

/** Motivo (para el usuario) por el que no puede pagar `planKey` hoy. */
export function purchaseBlockedReason(m: Membership, planKey: string): string | null {
  if (canPurchase(m, planKey)) return null;
  if (m.state === "activo") {
    return "Tu plan está vigente: podrás renovarlo en los últimos días del período.";
  }
  if (planKey === "mantencion") return "El Plan Mantención es solo para ex clientes.";
  return "Ese plan no está disponible para renovar ahora.";
}

/** ¿Toca el correo de seguimiento hoy? Solo si el período termina pronto y no se renovó. */
export function followupDue(m: Membership, alreadySent: boolean): boolean {
  if (alreadySent || m.renewed || !isActiveMembership(m) || m.daysLeft === null) return false;
  return m.daysLeft <= FOLLOWUP_DAYS_BEFORE_END;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "6 nov 2026" (fecha corta en es-CL, sin zona horaria). */
export function formatPeriodDay(iso: string): string {
  const [y, m, d] = toDay(iso).split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${y}-${pad(m)}-${pad(d)}T12:00:00Z`));
  return label.replace(/\./g, "");
}

export interface FollowupEmailInput {
  clientName: string;
  contactName: string | null;
  planLabel: string;
  periodEnd: string;
  /** Link a Facturación para renovar o elegir cómo seguir. */
  renewUrl: string;
  /** Marca + Web: no se "renueva", se elige cómo continuar. */
  oneTime: boolean;
}

/** Correo de servicio (no marketing) antes del fin del período. Solo texto plano. */
export function buildFollowupEmail(input: FollowupEmailInput): {
  subject: string;
  lines: string[];
} {
  const hello = input.contactName?.trim() ? `Hola ${input.contactName.trim()},` : "Hola,";
  const until = formatPeriodDay(input.periodEnd);
  const next = input.oneTime
    ? "Si quieres seguir con contenido o campañas, puedes elegir tu plan mensual en tu panel:"
    : `Si quieres continuar, renueva tu plan en tu panel antes del ${until}:`;
  return {
    subject: `¿Cómo vas con ${input.planLabel}? Tu período termina el ${until}`,
    lines: [
      hello,
      "",
      `Tu período de ${input.planLabel} para ${input.clientName} termina el ${until}.`,
      "Queremos saber cómo te ha ido: ¿estás conforme con el trabajo? Responde este correo y cuéntanos qué mantener o mejorar.",
      "",
      next,
      input.renewUrl,
      "",
      "No hay cobros automáticos: si no renuevas, el servicio termina al cumplirse el período pagado.",
      "",
      "Equipo Vibranding",
    ],
  };
}
