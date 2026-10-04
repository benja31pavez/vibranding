import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, FileSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, ErrorState, ListSkeleton, Money, Panel, StatusBadge } from "@/components/app";
import { fichaKeys, formatDate, useUserKey } from "./fichaQueries";

/** Último contrato del cliente con su estado y montos. */
export function ContractPanel({ clientId }: { clientId: string }) {
  const userKey = useUserKey();
  const query = useQuery({
    queryKey: fichaKeys.contract(userKey, clientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contracts")
        .select("id,title,status,currency,total_monthly,total_one_time,effective_date,signed_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const contract = query.data;

  return (
    <Panel
      title="Contrato"
      icon={FileSignature}
      actions={
        <Link
          to="/clients/$clientId/facturacion"
          params={{ clientId }}
          search={{ tab: "contratos" }}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {contract ? "Ver contratos" : "Crear"} <ArrowRight aria-hidden className="h-3 w-3" />
        </Link>
      }
    >
      {query.isLoading ? (
        <ListSkeleton rows={1} label="Cargando contrato" />
      ) : query.error ? (
        <ErrorState message={query.error.message} onRetry={() => void query.refetch()} />
      ) : !contract ? (
        <EmptyState size="compact" title="Sin contrato" description="Genera uno desde Facturación." />
      ) : (
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{contract.title}</span>
            <StatusBadge status={contract.status} />
          </div>
          {contract.total_monthly > 0 && (
            <div className="text-muted-foreground">
              Mensual: <Money amount={contract.total_monthly} currency={contract.currency} className="text-foreground" />
            </div>
          )}
          {contract.total_one_time > 0 && (
            <div className="text-muted-foreground">
              Pago único: <Money amount={contract.total_one_time} currency={contract.currency} className="text-foreground" />
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {contract.signed_at ? `Firmado el ${formatDate(contract.signed_at)}` : `Vigencia desde ${formatDate(contract.effective_date)}`}
          </div>
        </div>
      )}
    </Panel>
  );
}
