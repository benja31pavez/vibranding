import { CalendarSection } from "@/components/portal/CalendarSection";
import { portalModeFor } from "@/components/portal/usePortal";
import { usePanelMode } from "./panelMode";
import { PortalSectionPage } from "./PortalSectionPage";

/** El cliente sale de la sesión (getPortalCalendar usa user_client_id()) o de la vista previa validada. */
export function CalendarPage() {
  const mode = portalModeFor(usePanelMode().preview);
  return (
    <PortalSectionPage title="Calendario">
      <CalendarSection mode={mode} enabled />
    </PortalSectionPage>
  );
}
