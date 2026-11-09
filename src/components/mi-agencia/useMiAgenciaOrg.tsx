import { Building2 } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/app";
import {
  ORG_MANAGER_ROLES,
  useCurrentOrg,
  type CurrentOrg,
  type OrgRole,
} from "@/lib/agency/queries";

/**
 * Hook + render helpers compartidos por las pantallas de /mi-agencia. Resuelve
 * la org del usuario y expone un bloque de carga/error/estado vacío estándar.
 */
export function useMiAgenciaOrg() {
  const org = useCurrentOrg();
  const canManage = org.data
    ? (ORG_MANAGER_ROLES as readonly OrgRole[]).includes(org.data.role)
    : false;
  return { org, canManage };
}

export function MiAgenciaOrgGate({
  org,
  children,
}: {
  org: ReturnType<typeof useCurrentOrg>;
  children: (data: CurrentOrg) => React.ReactNode;
}) {
  if (org.isLoading) return <ListSkeleton rows={4} label="Cargando tu agencia" />;
  if (org.error)
    return (
      <ErrorState
        title="No pudimos cargar tu agencia"
        message={org.error.message}
        onRetry={() => void org.refetch()}
      />
    );
  if (!org.data)
    return (
      <EmptyState
        icon={Building2}
        title="No perteneces a ninguna agencia"
        description="Mi agencia muestra los datos de la organización dueña del panel. Pídele a un administrador que te invite."
      />
    );
  return <>{children(org.data)}</>;
}
