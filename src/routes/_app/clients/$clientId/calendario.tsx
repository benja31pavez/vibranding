import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClientCalendar, type ClientCalendarSearch } from "@/components/agenda/ClientCalendar";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { isDayKey } from "@/lib/agenda/dates";
import { AGENDA_KINDS } from "@/lib/agenda/types";

function parseKinds(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const kinds = AGENDA_KINDS.filter((k) => raw.split(",").includes(k));
  return kinds.length > 0 && kinds.length < AGENDA_KINDS.length ? kinds.join(",") : undefined;
}

export const Route = createFileRoute("/_app/clients/$clientId/calendario")({
  validateSearch: (s: Record<string, unknown>): ClientCalendarSearch => ({
    vista: s.vista === "semana" || s.vista === "lista" ? s.vista : undefined,
    fecha: isDayKey(s.fecha) ? s.fecha : undefined,
    tipos: parseKinds(s.tipos),
  }),
  head: () => ({
    meta: [
      { title: "Calendario del cliente | Vibranding" },
      {
        name: "description",
        content: "Publicaciones, entregas, tareas del Plan, cobros y reservas del cliente.",
      },
    ],
  }),
  component: ClientCalendarPage,
});

function ClientCalendarPage() {
  const { clientId } = Route.useParams();
  const { client } = useActiveClient();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/clients/$clientId/calendario" });
  return (
    <ClientCalendar
      clientId={clientId}
      clientName={client?.name ?? ""}
      search={search}
      setSearch={(patch) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })}
    />
  );
}
