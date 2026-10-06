import { createFileRoute } from "@tanstack/react-router";
import { hmacSha256Hex, timingSafeEqualHex } from "@/lib/crypto";
import {
  CRON_CALL_BUDGET_MS,
  batchStatus,
  missingBatchesError,
  parseBatchParams,
} from "@/lib/cron/batch";
import { chileToday } from "@/lib/dates/chile";
import { isMonthKey, nextMonth } from "@/lib/delivery/monthPlan";

/** Igual que PLAN_CYCLE_MAX_BATCH_LIMIT de planCycle.server (no se importa: es solo servidor). */
const MAX_LIMIT = 10;

/**
 * ?month=AAAA-MM (opcional): crea solo ese mes; debe ser el actual o el
 * siguiente. Sin month: el actual y, desde el día 25, también el siguiente.
 */
function parseMonth(params: URLSearchParams): string[] | undefined | { error: string } {
  const month = params.get("month");
  if (month === null) return undefined;
  const current = chileToday().slice(0, 7);
  if (!isMonthKey(month) || (month !== current && month !== nextMonth(current))) {
    return { error: "month debe ser el mes actual o el siguiente (AAAA-MM)" };
  }
  return [month];
}

/**
 * Ciclo mensual del plan. Lo llaman los jobs 'plan_cycle_<offset>' (migración
 * 20261012002010_cron_plan_ciclo.sql) el día 25 con x-dispatch-secret. Cada
 * llamada procesa UN lote de clientes activos con plan mensual (?offset=&limit=,
 * máx. 10, orden estable por client_id) y crea las tareas del ciclo que falten
 * (idempotente por cliente + mes). Nunca borra ni edita tareas. Cualquier fallo
 * responde 500 (job_runs toma todo 2xx como éxito); el último job lleva &last=1
 * y avisa si faltan lotes.
 */
export const Route = createFileRoute("/api/public/plan/monthly-cycle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const deadlineMs = Date.now() + CRON_CALL_BUDGET_MS;
        const expected = process.env.DISPATCH_SECRET;
        if (!expected) {
          console.error("[plan ciclo] DISPATCH_SECRET missing — rejecting request");
          return new Response("Server misconfigured", { status: 500 });
        }
        const provided = request.headers.get("x-dispatch-secret") ?? "";
        const [a, b] = await Promise.all([
          hmacSha256Hex(expected, provided),
          hmacSha256Hex(expected, expected),
        ]);
        if (!provided || !timingSafeEqualHex(a, b)) {
          return new Response("Forbidden", { status: 403 });
        }

        const params = new URL(request.url).searchParams;
        const parsed = parseBatchParams(params, { defaultLimit: MAX_LIMIT, maxLimit: MAX_LIMIT });
        if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
        const months = parseMonth(params);
        if (months && "error" in months) {
          return Response.json({ error: months.error }, { status: 400 });
        }

        try {
          const { runPlanCycleBatch } = await import("@/lib/delivery/planCycle.server");
          const summary = await runPlanCycleBatch({ ...parsed, deadlineMs, months });
          const missing = missingBatchesError(parsed.last, summary.next_offset);
          if (missing) {
            console.error("[plan ciclo]", missing);
            return Response.json({ ...summary, error: missing }, { status: 500 });
          }
          return Response.json(summary, { status: batchStatus(summary.failed) });
        } catch (e) {
          console.error("[plan ciclo] error", (e as Error).message);
          return Response.json(
            { error: "No se pudo crear el ciclo mensual del plan" },
            { status: 500 },
          );
        }
      },
    },
  },
});
