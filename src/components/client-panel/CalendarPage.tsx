import { CalendarSection } from "@/components/portal/CalendarSection";
import type { PortalMode } from "@/components/portal/usePortal";
import { PortalSectionPage } from "./PortalSectionPage";

/** El cliente sale de la sesión (getPortalCalendar usa user_client_id()), no de la URL. */
const CLIENT_MODE: PortalMode = { kind: "client" };

export function CalendarPage() {
  return (
    <PortalSectionPage title="Calendario">
      <CalendarSection mode={CLIENT_MODE} enabled />
    </PortalSectionPage>
  );
}
