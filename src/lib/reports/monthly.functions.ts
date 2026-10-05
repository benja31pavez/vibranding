import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { allowPublicView, privateHeaders, RATE_LIMITED } from "@/lib/security/publicToken";
import type { GeneratedReport } from "./monthly.server";
import { isReportData, type MonthlyReportData } from "./types";

const GenerateInput = z.object({
  clientId: z.string().uuid(),
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, "El periodo debe ser el primer día del mes (YYYY-MM-01)")
    .optional(),
  /** Regenerar aunque ya se haya enviado (la UI pide confirmación). */
  force: z.boolean().optional(),
});

/** Una generación manual por cliente y periodo cada 60 s. */
const GENERATE_COOLDOWN_MS = 60_000;

/** "Generar ahora": arma el reporte del mes anterior (o `period`) de un cliente. Solo editores. */
export const generateMonthlyReportNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string; period?: string; force?: boolean }) =>
    GenerateInput.parse(d),
  )
  .handler(async ({ data, context }): Promise<GeneratedReport> => {
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, data.clientId);

    const { defaultReportPeriod } = await import("./period");
    const period = data.period ?? defaultReportPeriod();
    if (period > defaultReportPeriod()) {
      throw new Error("Solo se pueden generar reportes de meses ya cerrados.");
    }

    const { generateMonthlyReport, lastGeneratedAt } = await import("./monthly.server");
    const last = await lastGeneratedAt(data.clientId, period);
    if (last && Date.now() - new Date(last).getTime() < GENERATE_COOLDOWN_MS) {
      throw new Error(
        "Este reporte se acaba de generar. Espera un minuto antes de volver a intentarlo.",
      );
    }
    return generateMonthlyReport(data.clientId, period, { force: data.force });
  });

const TokenInput = z.object({ token: z.string().regex(/^[0-9a-f]{48}$/) });

export interface PublicMonthlyReport {
  clientName: string;
  period: string;
  data: MonthlyReportData;
  summary: string | null;
  sentAt: string | null;
}

/**
 * Lectura pública por token (página /r/$token). Usa get_monthly_report_by_token,
 * que solo devuelve reportes ya enviados (sent_at no nulo). Mismas cabeceras
 * privadas y límite de lecturas por IP que la propuesta pública (/p/$token).
 */
export const getPublicMonthlyReport = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => {
    const parsed = TokenInput.safeParse(d);
    return { token: parsed.success ? parsed.data.token : "" };
  })
  .handler(async ({ data }): Promise<PublicMonthlyReport | null> => {
    privateHeaders();
    if (!(await allowPublicView("report-view", data.token || "invalid")))
      throw new Error(RATE_LIMITED);
    if (!data.token) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("get_monthly_report_by_token", {
      _token: data.token,
    });
    if (error) {
      console.error("[reports] lectura pública falló", error.message);
      throw new Error("No pudimos cargar el reporte. Intenta de nuevo en unos minutos.");
    }
    const payload = res as { ok?: boolean; report?: Record<string, unknown> } | null;
    const report = payload?.ok ? payload.report : null;
    if (!report || !isReportData(report.data)) return null;
    return {
      clientName: String(report.client_name ?? ""),
      period: String(report.period ?? ""),
      data: report.data,
      summary: typeof report.summary === "string" ? report.summary : null,
      sentAt: typeof report.sent_at === "string" ? report.sent_at : null,
    };
  });
