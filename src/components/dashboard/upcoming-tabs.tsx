import { useState, type ReactNode } from "react";
import { CalendarRange } from "lucide-react";
import { Panel } from "@/components/app";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ApprovalsTab } from "./approvals-today";
import { AlertsTab } from "./campaign-alerts";
import {
  DeliverablesTab,
  PostsTab,
  useScheduledPosts,
  useUpcomingDeliverables,
} from "./operations";
import { PaymentsTab } from "./upcoming-payments";
import { useApprovalsSummary, useOpenCampaignAlerts, useOpenPayments } from "./queries";

type TabKey = "cobros" | "posts" | "etapas" | "alertas" | "aprobaciones";

interface TabDef {
  key: TabKey;
  /** Etiqueta completa (desde 2xl y para lectores de pantalla). */
  label: string;
  /** Etiqueta corta para columnas angostas. */
  short: string;
  count: number | undefined;
  /** Resalta el contador (vencidos, alertas críticas). */
  urgent?: boolean;
  content: ReactNode;
}

/** Qué pestaña pide antes una acción de Benja (las publicaciones son solo informativas). */
const ACTION_PRIORITY: readonly TabKey[] = ["aprobaciones", "cobros", "etapas", "alertas", "posts"];

/**
 * Pestaña que se abre sola: la primera urgente (cobros vencidos, alertas críticas);
 * si no, la de mayor prioridad con pendientes; si todo está vacío, "Cobros".
 */
function suggestedTab(tabs: readonly TabDef[]): TabKey {
  const urgent = tabs.find((t) => t.urgent);
  if (urgent) return urgent.key;
  const withItems = ACTION_PRIORITY.find((key) =>
    tabs.some((t) => t.key === key && (t.count ?? 0) > 0),
  );
  return withItems ?? "cobros";
}

/**
 * Columna "Próximos días" de Inicio: cobros, publicaciones, etapas, alertas de
 * campañas y aprobaciones en pestañas; cada pestaña es una lista a pantalla
 * (FitList) con paginador y "Ver todos".
 */
export function UpcomingTabs() {
  const payments = useOpenPayments();
  const posts = useScheduledPosts();
  const deliverables = useUpcomingDeliverables();
  const alerts = useOpenCampaignAlerts();
  const approvals = useApprovalsSummary();
  // null = el usuario aún no elige: se abre la pestaña que más pide atención.
  const [picked, setPicked] = useState<TabKey | null>(null);

  // Si nunca hubo alertas (el job aún no corre o no hay clientes con Meta) no se muestra la pestaña.
  const showAlerts = !(alerts.data && alerts.data.everCount === 0);
  const tabs: TabDef[] = [
    {
      key: "cobros",
      label: "Cobros",
      short: "Cobros",
      count: payments.data?.agenda.length,
      urgent: (payments.data?.overdue.length ?? 0) > 0,
      content: <PaymentsTab />,
    },
    {
      key: "posts",
      label: "Publicaciones",
      short: "Posts",
      count: posts.data?.length,
      content: <PostsTab />,
    },
    {
      key: "etapas",
      label: "Etapas",
      short: "Etapas",
      count: deliverables.data?.length,
      content: <DeliverablesTab />,
    },
    ...(showAlerts
      ? [
          {
            key: "alertas" as const,
            label: "Alertas",
            short: "Alertas",
            count: alerts.data?.open.length,
            urgent: alerts.data?.open.some((a) => a.severity === "critical"),
            content: <AlertsTab />,
          },
        ]
      : []),
    {
      key: "aprobaciones",
      label: "Aprobaciones",
      short: "Aprobar",
      count: approvals.data?.total,
      content: <ApprovalsTab />,
    },
  ];
  const active = picked && tabs.some((t) => t.key === picked) ? picked : suggestedTab(tabs);

  return (
    <Panel fill icon={CalendarRange} title="Próximos días" bodyClassName="pb-3">
      <Tabs
        value={active}
        onValueChange={(v) => setPicked(v as TabKey)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList
          className="grid h-auto w-full shrink-0 gap-0.5"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              aria-label={t.count ? `${t.label} (${t.count})` : t.label}
              className="min-w-0 flex-col gap-0 px-1 py-1 text-xs"
            >
              <span className="max-w-full truncate 2xl:hidden">{t.short}</span>
              <span className="hidden max-w-full truncate 2xl:inline">{t.label}</span>
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  t.urgent ? "text-danger-strong" : "text-muted-foreground",
                )}
              >
                {t.count ?? "–"}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent
            key={t.key}
            value={t.key}
            className="mt-2 flex-col data-[state=active]:flex md:min-h-0 md:flex-1"
          >
            {t.content}
          </TabsContent>
        ))}
      </Tabs>
    </Panel>
  );
}
