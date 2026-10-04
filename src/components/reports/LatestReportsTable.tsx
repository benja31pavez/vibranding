import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, FileBarChart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, ErrorState, ListSkeleton, Panel, StatusBadge } from "@/components/app";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { periodLabel } from "@/lib/billing/dates";
import { defaultReportPeriod } from "@/lib/reports/period";
import { publicReportUrl, usePeriodReports } from "./reportQueries";

/** Estado del reporte del último mes cerrado para cada cliente. */
export function LatestReportsTable() {
  const { user } = useAuth();
  const userKey = user?.id ?? "anon";
  const period = defaultReportPeriod();
  const reports = usePeriodReports(userKey, period);
  const clients = useQuery({
    queryKey: ["clients-names", userKey],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name,status").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(publicReportUrl(token));
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar el link");
    }
  };

  const loading = reports.isLoading || clients.isLoading;
  const error = reports.error ?? clients.error;
  const byClient = new Map((reports.data ?? []).map((r) => [r.client_id, r]));
  const rows = (clients.data ?? []).filter((c) => c.status === "activo" || byClient.has(c.id));

  return (
    <Panel
      title={`Reportes mensuales · ${periodLabel(period)}`}
      icon={FileBarChart}
      description="Se generan el día 1 para los clientes activos. Revisa el resumen y márcalo como enviado desde la ficha."
    >
      {loading ? (
        <ListSkeleton rows={3} label="Cargando reportes" />
      ) : error ? (
        <ErrorState
          message={error.message}
          onRetry={() => {
            void reports.refetch();
            void clients.refetch();
          }}
        />
      ) : rows.length === 0 ? (
        <EmptyState icon={FileBarChart} title="No hay clientes activos" />
      ) : (
        <ul className="divide-y divide-border-subtle">
          {rows.map((c) => {
            const r = byClient.get(c.id);
            const status = !r ? null : r.sent_at ? "sent" : "draft";
            return (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <Link to="/clients/$clientId" params={{ clientId: c.id }} className="truncate font-medium hover:underline">
                  {c.name}
                </Link>
                <span className="flex shrink-0 items-center gap-2">
                  {status ? (
                    <StatusBadge status={status} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin generar</span>
                  )}
                  {r?.sent_at && (
                    <Button size="sm" variant="ghost" onClick={() => copy(r.token)} aria-label={`Copiar link de ${c.name}`}>
                      <Copy aria-hidden className="h-4 w-4" />
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
