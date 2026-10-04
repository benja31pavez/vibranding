import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GeneratedReport } from "./monthly.server";
import { isReportData, type MonthlyReportData } from "./types";

const GenerateInput = z.object({
  clientId: z.string().uuid(),
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, "El periodo debe ser el primer día del mes (YYYY-MM-01)")
    .optional(),
});

/** "Generar ahora": arma el reporte del mes anterior (o `period`) de un cliente. Solo editores. */
export const generateMonthlyReportNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { clientId: string; period?: string }) => GenerateInput.parse(d))
  .handler(async ({ data, context }): Promise<GeneratedReport> => {
    const { assertCanEditClient } = await import("@/lib/auth/clientAccess.server");
    await assertCanEditClient(context.userId, data.clientId);
    const { generateMonthlyReport } = await import("./monthly.server");
    return generateMonthlyReport(data.clientId, data.period);
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
 * que solo devuelve reportes ya enviados (sent_at no nulo).
 */
export const getPublicMonthlyReport = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => {
    const parsed = TokenInput.safeParse(d);
    return { token: parsed.success ? parsed.data.token : "" };
  })
  .handler(async ({ data }): Promise<PublicMonthlyReport | null> => {
    if (!data.token) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("get_monthly_report_by_token", { _token: data.token });
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
