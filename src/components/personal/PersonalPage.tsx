import { CalendarRange, Clock, ExternalLink, ShieldCheck, Users } from "lucide-react";
import { EmptyState, PageHeader, Panel, SectionTabs, type SectionTab } from "@/components/app";
import { Button } from "@/components/ui/button";

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
  resumen: "Equipo del cliente: estructura pensada para listarlo cuando existan los datos",
  equipo: "Personas del equipo del cliente, con cargo, contacto y estado",
  roles: "Permisos y responsabilidades del equipo del cliente",
  historial: "Ingresos y salidas del equipo del cliente",
};

import { whatsappUrl } from "@/lib/site";

/** WhatsApp de Vibranding para pedir los datos del equipo del cliente. */
const WHATSAPP_URL = whatsappUrl(
  "Hola, quiero cargar en Personal los datos del equipo del cliente. Les envío por aquí la lista.",
);

interface PersonalPageProps {
  /** Se mantiene por paridad con las otras secciones; se usará cuando exista la tabla de empleados. */
  clientId: string;
  tab: PersonalTab;
  onTabChange: (tab: PersonalTab) => void;
}

/**
 * Sección "Personal" del cliente: espacio reservado para listar el equipo del cliente
 * cuando exista la tabla de empleados. Hoy todas las pestañas son EmptyState honesto
 * describiendo qué mostrará cada una.
 */
export function PersonalPage({ clientId: _clientId, tab, onTabChange }: PersonalPageProps) {
  const header = (
    <div className="flex flex-col gap-3">
      <PageHeader size="compact" title="Personal" description={DESCRIPTION[tab]} />
      <SectionTabs tabs={TABS} value={tab} onChange={onTabChange} label="Vistas de Personal" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}
      {tab === "resumen" && <PersonalResumen onTabChange={onTabChange} />}
      {tab === "equipo" && <PersonalEquipo />}
      {tab === "roles" && <PersonalRoles />}
      {tab === "historial" && <PersonalHistorial />}
    </div>
  );
}

function PersonalResumen({ onTabChange }: { onTabChange: (tab: PersonalTab) => void }) {
  return (
    <>
      <EmptyState
        icon={Users}
        title="Aún no hay equipo cargado para este cliente"
        description="Cuando exista la tabla de empleados en la plataforma, aquí verás un resumen del equipo del cliente: cantidad de personas activas, en licencia o de vacaciones, el último ingreso o salida, y quiénes son los contactos clave. Hoy todavía no hay datos ni manera de cargarlos desde la plataforma."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild>
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                Pedirle los datos del equipo a Benjamín
                <ExternalLink className="ml-1 h-4 w-4" aria-hidden />
              </a>
            </Button>
            <Button variant="outline" onClick={() => onTabChange("equipo")}>
              Ver qué mostrará cada pestaña
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-3">
        <Panel title="Equipo" icon={Users} description="Lo que mostrará esta pestaña">
          <p className="text-sm text-muted-foreground">
            Pronto podrás listar personas con su nombre, cargo, correo, teléfono, estado (activo,
            licencia, vacaciones) y antigüedad.
          </p>
        </Panel>
        <Panel title="Roles" icon={ShieldCheck} description="Lo que mostrará esta pestaña">
          <p className="text-sm text-muted-foreground">
            Permisos y responsabilidades por cargo o área: quién firma, quién aprueba pagos, quién
            publica en redes y quién atiende al cliente.
          </p>
        </Panel>
        <Panel title="Historial" icon={Clock} description="Lo que mostrará esta pestaña">
          <p className="text-sm text-muted-foreground">
            Ingresos y salidas del equipo del cliente, con fecha y motivo (contrato, término, cambio
            de cargo).
          </p>
        </Panel>
      </div>
    </>
  );
}

function PersonalEquipo() {
  return (
    <EmptyState
      icon={Users}
      title="Todavía no se puede listar al equipo del cliente"
      description="Pronto podrás listar personas con su nombre, cargo, correo, teléfono, estado (activo, licencia, vacaciones) y antigüedad. Falta crear la tabla de empleados en la base de datos; mientras tanto no mostramos nombres inventados."
      action={
        <Button asChild>
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
            Enviarle los datos a Benjamín
            <ExternalLink className="ml-1 h-4 w-4" aria-hidden />
          </a>
        </Button>
      }
    />
  );
}

function PersonalRoles() {
  return (
    <EmptyState
      icon={ShieldCheck}
      title="Todavía no se pueden configurar roles"
      description="Aquí verás los permisos y responsabilidades de cada cargo del equipo del cliente: quién firma, quién aprueba pagos, quién publica en redes y quién atiende al cliente. Se activa cuando exista la tabla de empleados."
    />
  );
}

function PersonalHistorial() {
  return (
    <EmptyState
      icon={CalendarRange}
      title="Todavía no se puede mostrar el historial"
      description="Aquí verás los ingresos y salidas del equipo del cliente, con fecha y motivo (contrato nuevo, término de contrato, cambio de cargo). Se activa cuando exista la tabla de empleados."
    />
  );
}
