import { Clock } from "lucide-react";
import { FitPage, PageHeader } from "@/components/app";
import type { ClientPanelSection } from "./sections";

/** Sección cuya lectura se abre en la Fase 2: una sola línea, sin datos ni errores. */
export function ComingSoonPage({ section }: { section: ClientPanelSection }) {
  const Icon = section.icon;
  return (
    <FitPage header={<PageHeader size="compact" title={section.label} />}>
      <div className="flex max-w-md items-center gap-3 rounded-app-lg border border-border-subtle bg-surface px-5 py-4 shadow-app-xs">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-app-md bg-brand-soft text-brand-1">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock aria-hidden className="h-4 w-4" /> Disponible pronto
        </p>
      </div>
    </FitPage>
  );
}
