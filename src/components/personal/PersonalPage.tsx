import { useMemo, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarRange,
  Clock,
  LogIn,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { differenceInMonths, differenceInYears, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  CompactStats,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FitPage,
  ListSkeleton,
  PageHeader,
  Panel,
  SectionTabs,
  StatusBadge,
  type SectionTab,
  type StatusTone,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFichaOverview } from "@/components/clients/ficha/fichaQueries";
import { chileToday } from "@/lib/dates/chile";
import { cn } from "@/lib/utils";
import { EmployeeDialog } from "./EmployeeDialog";
import {
  EMPLOYEE_STATUSES,
  EMPLOYEE_STATUS_META,
  isEmployeeStatus,
  useClientEmployees,
  useDeleteEmployee,
  useSetEmployeeStatus,
  type Employee,
  type EmployeeStatus,
} from "./personalData";

export type PersonalTab = "resumen" | "equipo" | "roles" | "historial";

export const PERSONAL_TABS: readonly PersonalTab[] = ["resumen", "equipo", "roles", "historial"];

export function isPersonalTab(v: unknown): v is PersonalTab {
  return typeof v === "string" && (PERSONAL_TABS as readonly string[]).includes(v);
}

const TABS: readonly SectionTab<PersonalTab>[] = [
  { key: "resumen", label: "Resumen" },
  { key: "equipo", label: "Equipo" },
  { key: "roles", label: "Roles" },
  { key: "historial", label: "Historial" },
];

const DESCRIPTION: Readonly<Record<PersonalTab, string>> = {
  resumen: "Tamaño del equipo del cliente y últimos cambios",
  equipo: "Personas del equipo del cliente, con cargo, estado y antigüedad",
  roles: "Cuántas personas hay por cargo y rango",
  historial: "Ingresos y salidas del equipo del cliente",
};

interface PersonalPageProps {
  clientId: string;
  tab: PersonalTab;
  onTabChange: (tab: PersonalTab) => void;
}

/**
 * Sección "Personal" del cliente: CRUD de empleados del cliente pyme.
 * Cuatro subsecciones: Resumen, Equipo, Roles e Historial. Todos los datos
 * vienen de `public.client_employees` para este `clientId`; si no hay filas,
 * se muestra un EmptyState honesto.
 */
export function PersonalPage({ clientId, tab, onTabChange }: PersonalPageProps) {
  const overview = useFichaOverview(clientId);
  const canEdit = Boolean(overview.data?.canEdit);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(e: Employee) {
    setEditing(e);
    setDialogOpen(true);
  }

  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader
        size="compact"
        title="Personal"
        description={DESCRIPTION[tab]}
        actions={
          canEdit ? (
            <Button onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              Agregar empleado
            </Button>
          ) : undefined
        }
      />
      <SectionTabs tabs={TABS} value={tab} onChange={onTabChange} label="Vistas de Personal" />
    </div>
  );

  return (
    <>
      <FitPage header={header} scroll contentClassName="flex flex-col gap-4">
        {tab === "resumen" && (
          <ResumenView
            clientId={clientId}
            canEdit={canEdit}
            onCreate={openCreate}
            onTabChange={onTabChange}
          />
        )}
        {tab === "equipo" && (
          <EquipoView
            clientId={clientId}
            canEdit={canEdit}
            onCreate={openCreate}
            onEdit={openEdit}
          />
        )}
        {tab === "roles" && (
          <RolesView clientId={clientId} canEdit={canEdit} onTabChange={onTabChange} />
        )}
        {tab === "historial" && (
          <HistorialView clientId={clientId} canEdit={canEdit} onTabChange={onTabChange} />
        )}
      </FitPage>
      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        employee={editing}
      />
    </>
  );
}

// ------------------------------------------------------------------ comunes

function LoadGate({
  loading,
  error,
  retry,
  retrying,
  children,
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
  retrying: boolean;
  children: React.ReactNode;
}) {
  if (error) {
    return (
      <ErrorState
        title="No pudimos cargar al equipo del cliente"
        message={error}
        onRetry={retry}
        retrying={retrying}
      />
    );
  }
  if (loading) return <ListSkeleton rows={5} label="Cargando equipo" />;
  return <>{children}</>;
}

/** Formato fecha corta en español de Chile (p. ej. "3 may 2024"). */
const DATE_FMT = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "America/Santiago",
});
function fmtDate(ymd: string | null): string {
  if (!ymd) return "—";
  try {
    return DATE_FMT.format(parseISO(ymd));
  } catch {
    return ymd;
  }
}

/** Antigüedad legible desde `started_at` (hasta hoy, en Chile). */
function antiguedad(startedAt: string | null): string {
  if (!startedAt) return "—";
  let start: Date;
  try {
    start = parseISO(startedAt);
  } catch {
    return "—";
  }
  const now = parseISO(chileToday());
  if (start > now) return "Aún no ingresa";
  const years = differenceInYears(now, start);
  if (years >= 1) {
    return years === 1 ? "1 año" : `${years} años`;
  }
  const months = differenceInMonths(now, start);
  if (months >= 1) {
    return months === 1 ? "1 mes" : `${months} meses`;
  }
  return "Menos de 1 mes";
}

function statusBadgeFor(status: string) {
  const meta = isEmployeeStatus(status)
    ? EMPLOYEE_STATUS_META[status]
    : { label: status, tone: "neutral" as StatusTone };
  return <StatusBadge status={status} label={meta.label} tone={meta.tone} />;
}

function countsByStatus(list: readonly Employee[]): Record<EmployeeStatus, number> {
  const c: Record<EmployeeStatus, number> = {
    activo: 0,
    licencia: 0,
    vacaciones: 0,
    permiso: 0,
    terminado: 0,
  };
  for (const e of list) {
    if (isEmployeeStatus(e.status)) c[e.status]++;
  }
  return c;
}

// ------------------------------------------------------------------ Resumen

function ResumenView({
  clientId,
  canEdit,
  onCreate,
  onTabChange,
}: {
  clientId: string;
  canEdit: boolean;
  onCreate: () => void;
  onTabChange: (t: PersonalTab) => void;
}) {
  const query = useClientEmployees(clientId);
  const list = useMemo(() => query.data ?? [], [query.data]);
  const counts = useMemo(() => countsByStatus(list), [list]);

  const total = list.length;
  const auSentes = counts.licencia + counts.vacaciones + counts.permiso;
  const recent = useMemo(() => list.slice(0, 5), [list]);

  const stats = (
    <CompactStats
      label="Resumen del equipo"
      className="grid-flow-row grid-cols-2 md:grid-flow-col md:auto-cols-fr"
      items={[
        {
          key: "total",
          label: "Total de empleados",
          icon: Users,
          loading: query.isPending,
          value: total,
        },
        {
          key: "activos",
          label: "Activos",
          icon: BadgeCheck,
          loading: query.isPending,
          value: counts.activo,
        },
        {
          key: "ausentes",
          label: "En licencia o vacaciones",
          icon: CalendarRange,
          loading: query.isPending,
          value: auSentes,
          hint:
            auSentes > 0
              ? [
                  counts.licencia && `${counts.licencia} en licencia`,
                  counts.vacaciones && `${counts.vacaciones} de vacaciones`,
                  counts.permiso && `${counts.permiso} con permiso`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : undefined,
        },
        {
          key: "terminados",
          label: "Terminados",
          icon: LogOut,
          loading: query.isPending,
          value: counts.terminado,
        },
      ]}
    />
  );

  return (
    <>
      {stats}
      <LoadGate
        loading={query.isPending}
        error={query.error?.message ?? null}
        retry={() => void query.refetch()}
        retrying={query.isFetching}
      >
        {list.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Aún no hay empleados cargados"
            description="Aquí verás al equipo del cliente, cuántos están activos, en licencia o de vacaciones, y los últimos ingresos y salidas. Carga personas desde Equipo o con el botón de arriba para empezar."
            action={
              canEdit ? (
                <Button onClick={onCreate}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden />
                  Agregar empleado
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Solo quien pueda editar al cliente puede agregar empleados.
                </p>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Panel
              title="Por estado"
              icon={Users}
              description="Cómo se reparten los empleados del cliente ahora."
            >
              <ul className="flex flex-col gap-2">
                {EMPLOYEE_STATUSES.map((s) => {
                  const n = counts[s];
                  const pct = total > 0 ? (n / total) * 100 : 0;
                  return (
                    <li key={s} className="flex items-center gap-3">
                      <span className="w-28 shrink-0">
                        <StatusBadge
                          status={s}
                          label={EMPLOYEE_STATUS_META[s].label}
                          tone={EMPLOYEE_STATUS_META[s].tone}
                          className="w-full justify-center"
                        />
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-gradient-brand"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-sm font-semibold tabular-nums">{n}</span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
            <div className="min-w-0 md:col-span-2">
              <Panel
                title="Últimos empleados cargados"
                icon={UserPlus}
                description="Los cinco más recientes; el detalle completo está en Equipo."
                actions={
                  <Button variant="outline" size="sm" onClick={() => onTabChange("equipo")}>
                    Ver equipo
                  </Button>
                }
              >
                <ul className="divide-y divide-border-subtle">
                  {recent.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 py-2">
                      <div
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-foreground",
                        )}
                        aria-hidden
                      >
                        {initials(e.full_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{e.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[e.role, e.department].filter(Boolean).join(" · ") || "Sin cargo"}
                        </p>
                      </div>
                      {statusBadgeFor(e.status)}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        )}
      </LoadGate>
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// ------------------------------------------------------------------ Equipo

function EquipoView({
  clientId,
  canEdit,
  onCreate,
  onEdit,
}: {
  clientId: string;
  canEdit: boolean;
  onCreate: () => void;
  onEdit: (e: Employee) => void;
}) {
  const query = useClientEmployees(clientId);
  const list = useMemo(() => query.data ?? [], [query.data]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | EmployeeStatus>("todos");
  const [deptFilter, setDeptFilter] = useState<string>("todos");
  const [confirm, setConfirm] = useState<{ open: boolean; employee: Employee | null }>({
    open: false,
    employee: null,
  });

  const deleteMut = useDeleteEmployee(clientId);
  const statusMut = useSetEmployeeStatus(clientId);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of list) {
      if (e.department && e.department.trim()) set.add(e.department.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-CL"));
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((e) => {
      if (statusFilter !== "todos" && e.status !== statusFilter) return false;
      if (deptFilter !== "todos" && (e.department ?? "") !== deptFilter) return false;
      if (!q) return true;
      const haystack = [
        e.full_name,
        e.role ?? "",
        e.department ?? "",
        e.email ?? "",
        e.phone ?? "",
        e.rut ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [list, search, statusFilter, deptFilter]);

  async function handleStatus(e: Employee, next: EmployeeStatus) {
    try {
      await statusMut.mutateAsync({
        id: e.id,
        status: next,
        // Si se marca como terminado y no tenía fecha de salida, la fijamos a hoy.
        endedAt:
          next === "terminado" && !e.ended_at
            ? chileToday()
            : next !== "terminado" && e.ended_at
              ? null
              : undefined,
      });
      toast.success("Estado actualizado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado");
    }
  }

  async function handleDelete() {
    const target = confirm.employee;
    if (!target) return;
    try {
      await deleteMut.mutateAsync(target.id);
      toast.success("Empleado eliminado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setConfirm({ open: false, employee: null });
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
        <div className="relative md:flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cargo, correo o RUT"
            className="pl-9"
            aria-label="Buscar empleados"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex md:w-auto md:items-center">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "todos" | EmployeeStatus)}
          >
            <SelectTrigger className="md:w-44" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              {EMPLOYEE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {EMPLOYEE_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={deptFilter}
            onValueChange={setDeptFilter}
            disabled={departments.length === 0}
          >
            <SelectTrigger className="md:w-52" aria-label="Filtrar por departamento">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los departamentos</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <LoadGate
        loading={query.isPending}
        error={query.error?.message ?? null}
        retry={() => void query.refetch()}
        retrying={query.isFetching}
      >
        {list.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Todavía no hay empleados del cliente"
            description="Empieza cargando a las personas del equipo del cliente: nombre, cargo, departamento y estado. Esto se usa para el panel y los otros módulos (quién aprueba, quién firma, etc.)."
            action={
              canEdit ? (
                <Button onClick={onCreate}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden />
                  Agregar empleado
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Solo quien pueda editar al cliente puede agregar empleados.
                </p>
              )
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Ningún empleado coincide con los filtros"
            description="Prueba con otro término de búsqueda o cambia el filtro de estado o departamento."
          />
        ) : (
          <div className="overflow-x-auto rounded-app-lg border border-border-subtle bg-surface">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Cargo</TableHead>
                  <TableHead className="hidden md:table-cell">Departamento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden lg:table-cell">Antigüedad</TableHead>
                  <TableHead className="w-10 text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">{e.full_name}</span>
                        <span className="text-xs text-muted-foreground md:hidden">
                          {[e.role, e.department].filter(Boolean).join(" · ") || "Sin cargo"}
                        </span>
                        {e.email && (
                          <span className="hidden text-xs text-muted-foreground md:block">
                            {e.email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-foreground">{e.role || "—"}</span>
                      {e.rank && (
                        <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs text-muted-foreground">
                          {e.rank}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm text-foreground md:table-cell">
                      {e.department || "—"}
                    </TableCell>
                    <TableCell>{statusBadgeFor(e.status)}</TableCell>
                    <TableCell className="hidden text-sm text-foreground lg:table-cell">
                      {antiguedad(e.started_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Acciones de ${e.full_name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => onEdit(e)}>
                              <Pencil className="mr-2 h-4 w-4" aria-hidden />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Cambiar estado</DropdownMenuLabel>
                            {EMPLOYEE_STATUSES.filter((s) => s !== "terminado").map((s) => (
                              <DropdownMenuItem
                                key={s}
                                disabled={e.status === s}
                                onSelect={() => void handleStatus(e, s)}
                              >
                                {EMPLOYEE_STATUS_META[s].label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={e.status === "terminado"}
                              onSelect={() => void handleStatus(e, "terminado")}
                            >
                              <LogOut className="mr-2 h-4 w-4" aria-hidden />
                              Dar de baja
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-danger-strong focus:text-danger-strong"
                              onSelect={() => setConfirm({ open: true, employee: e })}
                            >
                              <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-xs text-muted-foreground">Solo lectura</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </LoadGate>

      <ConfirmDialog
        open={confirm.open}
        onOpenChange={(o) => setConfirm((prev) => ({ ...prev, open: o }))}
        title="Eliminar empleado"
        description={
          confirm.employee
            ? `Vas a eliminar el registro de ${confirm.employee.full_name}. Esta acción no se puede deshacer.`
            : undefined
        }
        destructive
        confirmLabel="Eliminar"
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

// ------------------------------------------------------------------ Roles

function RolesView({
  clientId,
  canEdit,
  onTabChange,
}: {
  clientId: string;
  canEdit: boolean;
  onTabChange: (t: PersonalTab) => void;
}) {
  const query = useClientEmployees(clientId);
  const list = useMemo(() => query.data ?? [], [query.data]);

  const byRole = useMemo(() => {
    const map = new Map<string, Employee[]>();
    for (const e of list) {
      const key = e.role?.trim() || "Sin cargo definido";
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }
    return Array.from(map.entries())
      .map(([role, items]) => ({ role, items }))
      .sort((a, b) => {
        if (a.role === "Sin cargo definido") return 1;
        if (b.role === "Sin cargo definido") return -1;
        return a.role.localeCompare(b.role, "es-CL");
      });
  }, [list]);

  return (
    <LoadGate
      loading={query.isPending}
      error={query.error?.message ?? null}
      retry={() => void query.refetch()}
      retrying={query.isFetching}
    >
      {list.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Todavía no hay roles que mostrar"
          description="Aquí verás la cantidad de personas por cargo y por rango. Agrega personas desde Equipo para empezar a poblar esta vista."
          action={
            canEdit ? (
              <Button variant="outline" onClick={() => onTabChange("equipo")}>
                <UsersRound className="mr-1 h-4 w-4" aria-hidden />
                Ir a Equipo
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {byRole.map(({ role, items }) => {
            const ranks = countRanks(items);
            return (
              <Panel
                key={role}
                title={role}
                icon={BriefcaseBusiness}
                description={`${items.length} ${items.length === 1 ? "persona" : "personas"}`}
              >
                <ul className="flex flex-col gap-2">
                  {ranks.map((r) => (
                    <li
                      key={r.key}
                      className="flex items-center justify-between rounded-app-sm bg-surface-2 px-3 py-1.5 text-sm"
                    >
                      <span className="text-foreground">{r.label}</span>
                      <span className="font-semibold tabular-nums">{r.count}</span>
                    </li>
                  ))}
                </ul>
                <ul className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground">
                  {items.slice(0, 5).map((e) => (
                    <li key={e.id} className="truncate">
                      {e.full_name}
                      {e.rank ? ` · ${e.rank}` : ""}
                    </li>
                  ))}
                  {items.length > 5 && <li className="italic">y {items.length - 5} más…</li>}
                </ul>
              </Panel>
            );
          })}
        </div>
      )}
    </LoadGate>
  );
}

function countRanks(
  items: readonly Employee[],
): readonly { key: string; label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const e of items) {
    const key = e.rank?.trim() || "Sin rango";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  // Orden preferido: Junior, Semi senior, Senior, Líder, otros, "Sin rango" al final.
  const order = ["Junior", "Semi senior", "Senior", "Líder"];
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => {
      if (a.key === "Sin rango") return 1;
      if (b.key === "Sin rango") return -1;
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.key.localeCompare(b.key, "es-CL");
    });
}

// ------------------------------------------------------------------ Historial

type HistoryEvent = {
  id: string;
  kind: "ingreso" | "salida";
  date: string;
  employee: Employee;
};

function HistorialView({
  clientId,
  canEdit,
  onTabChange,
}: {
  clientId: string;
  canEdit: boolean;
  onTabChange: (t: PersonalTab) => void;
}) {
  const query = useClientEmployees(clientId);
  const list = useMemo(() => query.data ?? [], [query.data]);

  const events = useMemo<readonly HistoryEvent[]>(() => {
    const acc: HistoryEvent[] = [];
    for (const e of list) {
      if (e.started_at) {
        acc.push({ id: `${e.id}-in`, kind: "ingreso", date: e.started_at, employee: e });
      }
      if (e.status === "terminado" && e.ended_at) {
        acc.push({ id: `${e.id}-out`, kind: "salida", date: e.ended_at, employee: e });
      }
    }
    acc.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return acc;
  }, [list]);

  return (
    <LoadGate
      loading={query.isPending}
      error={query.error?.message ?? null}
      retry={() => void query.refetch()}
      retrying={query.isFetching}
    >
      {list.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Todavía no hay historial"
          description="Aquí verás los ingresos y salidas del equipo del cliente, con fecha y nombre. Agrega personas desde Equipo con su fecha de ingreso para empezar."
          action={
            canEdit ? (
              <Button variant="outline" onClick={() => onTabChange("equipo")}>
                <UsersRound className="mr-1 h-4 w-4" aria-hidden />
                Ir a Equipo
              </Button>
            ) : undefined
          }
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Aún no hay fechas cargadas"
          description="Edita los empleados y agrega su fecha de ingreso para verlos en esta línea de tiempo."
        />
      ) : (
        <Panel
          title="Línea de tiempo"
          icon={CalendarRange}
          description={
            events.some((e) => e.kind === "salida")
              ? "Ingresos y salidas, del más reciente al más antiguo."
              : "Ingresos del equipo, del más reciente al más antiguo. Aún no hay salidas registradas."
          }
        >
          <ol className="flex flex-col gap-3">
            {events.map((ev) => {
              const isIngreso = ev.kind === "ingreso";
              return (
                <li key={ev.id} className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full",
                      isIngreso
                        ? "bg-success-subtle text-success-strong"
                        : "bg-neutral-subtle text-neutral-strong",
                    )}
                    aria-hidden
                  >
                    {isIngreso ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium text-foreground">
                        {isIngreso ? "Ingreso" : "Salida"}
                      </span>
                      <span className="text-muted-foreground"> · {fmtDate(ev.date)}</span>
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {ev.employee.full_name}
                      {ev.employee.role ? ` · ${ev.employee.role}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Panel>
      )}
    </LoadGate>
  );
}
