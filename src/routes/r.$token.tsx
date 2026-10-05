import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportView } from "@/components/reports/ReportView";
import { getPublicMonthlyReport } from "@/lib/reports/monthly.functions";
import { periodLabel } from "@/lib/billing/dates";

const NOINDEX = { name: "robots", content: "noindex, nofollow" };

export const Route = createFileRoute("/r/$token")({
  loader: ({ params }) => getPublicMonthlyReport({ data: { token: params.token } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Reporte de ${periodLabel(loaderData.period)} · ${loaderData.clientName} | Vibranding`
          : "Reporte mensual | Vibranding",
      },
      {
        name: "description",
        content: "Resultados del mes de tu marca, preparados por Vibranding.",
      },
      NOINDEX,
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: PublicReportPage,
  errorComponent: () => (
    <Shell>
      <Notice>No pudimos cargar el reporte. Intenta de nuevo en unos minutos.</Notice>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background print:bg-white">
      <header className="border-b bg-sidebar/95 print:border-none print:bg-transparent">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 md:px-6">
          <span className="font-brand text-2xl tracking-tight text-gradient-brand bg-gradient-brand-animated print:bg-none print:text-foreground">
            Vibranding
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-app-lg border bg-surface p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function PublicReportPage() {
  const report = Route.useLoaderData();
  if (!report) {
    return (
      <Shell>
        <Notice>
          Este enlace no es válido o el reporte todavía no está disponible. Pide uno nuevo a tu
          equipo de Vibranding.
        </Notice>
      </Shell>
    );
  }
  return (
    <Shell>
      <div className="mb-6 flex justify-end print:hidden">
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden className="mr-1.5 h-4 w-4" /> Imprimir o guardar PDF
        </Button>
      </div>
      <ReportView
        clientName={report.clientName}
        period={report.period}
        data={report.data}
        summary={report.summary}
      />
      <footer className="mt-10 border-t pt-4 text-xs text-muted-foreground">
        Preparado por Vibranding con datos reales de tus cuentas. Si una fuente no aparece, es
        porque no tuvo datos este mes.
      </footer>
    </Shell>
  );
}
