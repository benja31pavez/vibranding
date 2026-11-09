import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, ErrorState, Money, Panel, TableSkeleton } from "@/components/app";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";
import { addDaysYmd, chileToday } from "@/lib/dates/chile";
import { summarizeCampaigns, type InsightRow } from "@/lib/google-ads/campaigns";

export const GOOGLE_ADS_WINDOW_DAYS = 30;
const WINDOW_DAYS = GOOGLE_ADS_WINDOW_DAYS;
/** 30 días × muchas campañas cabe holgado; evita traer tablas enormes. */
const MAX_ROWS = 5000;

const INT = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const DEC = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

const googleAdsCampaignsKey = (userKey: string, clientId: string) =>
  ["google-ads-campaigns", userKey, clientId] as const;

/** Resumen por campaña de los últimos 30 días (hasta ayer), compartido por la tabla y el resumen. */
export function useGoogleAdsCampaigns(clientId: string) {
  const userKey = useUserKey();
  const to = addDaysYmd(chileToday(), -1);
  const from = addDaysYmd(to, -(WINDOW_DAYS - 1));
  return useQuery({
    queryKey: [...googleAdsCampaignsKey(userKey, clientId), from],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_ads_insights_daily")
        .select("campaign_id,campaign_name,date,clicks,cost_clp,conversions")
        .eq("client_id", clientId)
        .gte("date", from)
        .lte("date", to)
        .limit(MAX_ROWS);
      if (error) throw new Error(error.message);
      return summarizeCampaigns((data ?? []) as InsightRow[]);
    },
  });
}

/** Gasto, clics y conversiones por campaña de los últimos 30 días (datos ya guardados). */
export function GoogleAdsCampaignsTable({ clientId }: { clientId: string }) {
  const query = useGoogleAdsCampaigns(clientId);

  const totals = (query.data ?? []).reduce(
    (acc, c) => ({
      cost: acc.cost + c.costClp,
      clicks: acc.clicks + c.clicks,
      conv: acc.conv + c.conversions,
    }),
    { cost: 0, clicks: 0, conv: 0 },
  );

  return (
    <Panel
      title="Campañas de Google Ads"
      icon={BarChart3}
      description={`Últimos ${WINDOW_DAYS} días, hasta ayer`}
    >
      {query.isLoading ? (
        <TableSkeleton rows={4} columns={5} label="Cargando campañas" />
      ) : query.error ? (
        <ErrorState
          message={(query.error as Error).message}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          size="compact"
          icon={BarChart3}
          title="Sin datos todavía"
          description="Se descargan cada madrugada o con «Actualizar ahora»."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaña</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-right">Clics</TableHead>
                <TableHead className="text-right">Conversiones</TableHead>
                <TableHead className="text-right">
                  <abbr title="Costo por conversión" className="no-underline">
                    Costo/conv.
                  </abbr>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(query.data ?? []).map((c) => (
                <TableRow key={c.campaignId}>
                  <TableCell className="max-w-[320px] truncate font-medium" title={c.name}>
                    {c.name}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money amount={c.costClp} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{INT.format(c.clicks)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {DEC.format(c.conversions)}
                  </TableCell>
                  <TableCell className="text-right">
                    {c.costPerConversion === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <Money amount={c.costPerConversion} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">
                  <Money amount={totals.cost} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {INT.format(totals.clicks)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{DEC.format(totals.conv)}</TableCell>
                <TableCell className="text-right">
                  {totals.conv > 0 ? <Money amount={Math.round(totals.cost / totals.conv)} /> : "—"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
