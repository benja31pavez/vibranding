import type { ReactNode } from "react";
import { FitPage, PageHeader } from "@/components/app";

/**
 * Página del panel que reutiliza una sección del portal (datos ya seguros para
 * el cliente). Desde md la página no hace scroll: si la sección crece, se
 * desplaza dentro de su área.
 */
export function PortalSectionPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <FitPage header={<PageHeader size="compact" title={title} />}>
      <div className="md:h-full md:overflow-y-auto md:pr-1">{children}</div>
    </FitPage>
  );
}
