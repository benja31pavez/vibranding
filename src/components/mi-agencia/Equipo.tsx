import { useMemo } from "react";
import { Users, UserPlus, UserMinus, History, Shield } from "lucide-react";
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  Panel,
  SectionTabs,
  StatCard,
  StatusBadge,
  type SectionTab,
} from "@/components/app";
import {
  useAgencyEmployees,
  useOrgMembers,
  type CurrentOrg,
  type OrgMemberRow,
  type EmployeeRow,
} from "@/lib/agency/queries";

export type EquipoTab = "resumen" | "miembros" | "roles" | "historial";
export const EQUIPO_TABS: readonly EquipoTab[] = ["resumen", "miembros", "roles", "historial"];
export function isEquipoTab(v: unknown): v is EquipoTab {
  return typeof v === "string" && (EQUIPO_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<EquipoTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "miembros", label: "Miembros" },
  { key: "roles", label: "Roles" },
  { key: "historial", label: "Historial" },
];

const ROLE_LABEL: Record<string, string> = {
  owner: "Dueño",
  admin: "Administrador",
  agent: "Agente",
  viewer: "Solo lectura",
};

interface EquipoPanelProps {
  org: CurrentOrg;
  canManage: boolean;
  tab: EquipoTab;
  onTabChange: (tab: EquipoTab) => void;
}

export function EquipoPanel({ org, canManage, tab, onTabChange }: EquipoPanelProps) {
  const members = useOrgMembers(org.orgId);
  const employees = useAgencyEmployees(org.orgId);

  const employeesByUser = useMemo(() => {
    const map = new Map<string, EmployeeRow>();
    for (const e of employees.data ?? []) {
      if (e.user_id) map.set(e.user_id, e);
    }
    return map;
  }, [employees.data]);

  return (
    <div className="flex flex-col gap-4">
      <SectionTabs tabs={TABS} value={tab} onChange={onTabChange} label="Pestañas de Equipo" />

      {tab === "resumen" && <ResumenEquipo members={members} employees={employees} />}
      {tab === "miembros" && (
        <MiembrosPanel members={members} employeesByUser={employeesByUser} canManage={canManage} />
      )}
      {tab === "roles" && <RolesPanel members={members} employees={employees} />}
      {tab === "historial" && <HistorialPanel employees={employees} members={members} />}
    </div>
  );
}

function ResumenEquipo({
  members,
  employees,
}: {
  members: ReturnType<typeof useOrgMembers>;
  employees: ReturnType<typeof useAgencyEmployees>;
}) {
  const total = members.data?.length ?? 0;
  const activos = (employees.data ?? []).filter((e) => !e.ended_at).length;
  const sinPerfil = Math.max(0, total - (employees.data?.length ?? 0));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Miembros con cuenta"
        icon={Users}
        loading={members.isLoading}
        value={total}
        hint="org_members"
      />
      <StatCard
        label="Con ficha de RRHH"
        icon={Shield}
        loading={employees.isLoading}
        value={activos}
        hint="agency_employees"
      />
      <StatCard
        label="Sin ficha de RRHH"
        icon={UserPlus}
        loading={members.isLoading || employees.isLoading}
        value={sinPerfil}
      />
      <StatCard
        label="Egresos registrados"
        icon={UserMinus}
        loading={employees.isLoading}
        value={(employees.data ?? []).filter((e) => e.ended_at).length}
      />
    </div>
  );
}

function MiembrosPanel({
  members,
  employeesByUser,
  canManage,
}: {
  members: ReturnType<typeof useOrgMembers>;
  employeesByUser: Map<string, EmployeeRow>;
  canManage: boolean;
}) {
  if (members.isLoading) return <ListSkeleton rows={4} label="Cargando miembros" />;
  if (members.error) {
    return <ErrorState message={members.error.message} onRetry={() => void members.refetch()} />;
  }
  const rows = members.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Aún no hay miembros registrados"
        description="Invita a alguien de tu equipo para empezar a compartir el panel."
      />
    );
  }
  return (
    <Panel
      icon={Users}
      title={`Miembros (${rows.length})`}
      description="Usuarios con acceso al panel y sus roles de la plataforma."
    >
      <ul className="divide-y divide-border-subtle">
        {rows.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            employee={m.user_id ? (employeesByUser.get(m.user_id) ?? null) : null}
            canManage={canManage}
          />
        ))}
      </ul>
      {!canManage && (
        <p className="mt-3 text-xs text-muted-foreground">
          Solo los administradores pueden cambiar roles o remover miembros.
        </p>
      )}
    </Panel>
  );
}

function MemberRow({
  member,
  employee,
  canManage,
}: {
  member: OrgMemberRow;
  employee: EmployeeRow | null;
  canManage: boolean;
}) {
  const name = employee?.display_name || member.full_name || "Miembro sin nombre";
  const title = employee?.title || member.job_title || null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">
          {title ? <span>{title} · </span> : null}
          <StatusBadge
            status={member.role}
            label={ROLE_LABEL[member.role] ?? member.role}
            tone={member.role === "owner" || member.role === "admin" ? "info" : "neutral"}
          />
          <span className="ml-2 text-muted-foreground">desde {member.created_at.slice(0, 10)}</span>
        </p>
      </div>
      {canManage ? (
        <p className="text-xs text-muted-foreground">
          Invitar y cambiar roles aún no está habilitado desde aquí.
        </p>
      ) : null}
    </li>
  );
}

function RolesPanel({
  members,
  employees,
}: {
  members: ReturnType<typeof useOrgMembers>;
  employees: ReturnType<typeof useAgencyEmployees>;
}) {
  const byRole = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of members.data ?? []) {
      map.set(m.role, (map.get(m.role) ?? 0) + 1);
    }
    return map;
  }, [members.data]);
  const byArea = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of employees.data ?? []) {
      if (e.ended_at) continue;
      const key = (e.area || "Sin área").trim() || "Sin área";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [employees.data]);

  if (members.isLoading) return <ListSkeleton rows={3} label="Cargando roles" />;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Panel
        icon={Shield}
        title="Roles de la plataforma"
        description="Qué puede hacer cada miembro."
      >
        {byRole.size === 0 ? (
          <EmptyState size="compact" title="Sin miembros registrados." />
        ) : (
          <dl className="divide-y divide-border-subtle">
            {[...byRole.entries()].map(([role, count]) => (
              <Row key={role} label={ROLE_LABEL[role] ?? role} value={count} />
            ))}
          </dl>
        )}
      </Panel>
      <Panel icon={Users} title="Áreas / cargos" description="Desde las fichas de RRHH.">
        {byArea.size === 0 ? (
          <EmptyState
            size="compact"
            title="Aún no hay cargos registrados"
            description="Las áreas y cargos se registran al agregar la ficha de RRHH de cada miembro."
          />
        ) : (
          <dl className="divide-y divide-border-subtle">
            {[...byArea.entries()].map(([area, count]) => (
              <Row key={area} label={area} value={count} />
            ))}
          </dl>
        )}
      </Panel>
    </div>
  );
}

function HistorialPanel({
  employees,
  members,
}: {
  employees: ReturnType<typeof useAgencyEmployees>;
  members: ReturnType<typeof useOrgMembers>;
}) {
  if (employees.isLoading || members.isLoading) {
    return <ListSkeleton rows={4} label="Cargando historial" />;
  }
  if (employees.error) {
    return (
      <ErrorState message={employees.error.message} onRetry={() => void employees.refetch()} />
    );
  }
  const events = [
    ...(members.data ?? []).map((m) => ({
      kind: "join" as const,
      date: m.created_at.slice(0, 10),
      label: m.full_name || "Nuevo miembro",
      detail: `Se unió como ${ROLE_LABEL[m.role] ?? m.role}`,
    })),
    ...(employees.data ?? [])
      .filter((e) => Boolean(e.ended_at))
      .map((e) => ({
        kind: "leave" as const,
        date: (e.ended_at ?? "").slice(0, 10),
        label: e.display_name || "Miembro",
        detail: "Baja registrada",
      })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  if (events.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Sin movimientos registrados"
        description="Aquí aparecerán los ingresos (fecha de alta en org_members) y las bajas que registres."
      />
    );
  }
  return (
    <Panel
      icon={History}
      title="Historial de miembros"
      description="Ingresos y salidas registrados."
    >
      <ul className="divide-y divide-border-subtle">
        {events.map((e, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{e.label}</p>
              <p className="text-xs text-muted-foreground">{e.detail}</p>
            </div>
            <div className="text-xs text-muted-foreground">{e.date}</div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-sm font-medium">{value}</dd>
    </div>
  );
}
