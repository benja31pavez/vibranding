import { createFileRoute, redirect } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstagramPage } from "@/components/pages/InstagramPage";
import { ContentCalendar } from "@/components/instagram/ContentCalendar";
import { PostFeedbackPanel } from "@/components/instagram/PostFeedbackPanel";
import { EngagementCard, EngagementChip } from "@/components/instagram/EngagementCard";
import { PageHeader } from "@/components/app";

type InstagramTab = "grid" | "calendario" | "engagement";
const TABS: readonly InstagramTab[] = ["grid", "calendario", "engagement"];

export const Route = createFileRoute("/_app/clients/$clientId/instagram")({
  validateSearch: (s: Record<string, unknown>): { tab?: InstagramTab } => ({
    tab: TABS.includes(s.tab as InstagramTab)
      ? (s.tab as InstagramTab)
      : s.tab === "automatizacion" || s.tab === "automation"
        ? (s.tab as any)
        : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    // Legacy in-page automation tab now lives in its own section.
    if ((search as any)?.tab === "automatizacion" || (search as any)?.tab === "automation") {
      throw redirect({
        to: "/clients/$clientId/automatizacion",
        params,
        search: { tab: "comentarios" } as any,
      });
    }
  },
  head: () => ({
    meta: [
      { title: "Instagram del cliente | Vibranding" },
      { name: "description", content: "Grid propuesto y calendario de contenido programado." },
      { property: "og:title", content: "Instagram del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Grid propuesto y calendario de contenido programado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstagramTabsPage,
});

function InstagramTabsPage() {
  const { clientId } = Route.useParams();
  const { tab = "grid" } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <div className="space-y-4">
      <PageHeader
        size="compact"
        title="Instagram"
        actions={<EngagementChip clientId={clientId} />}
      />
      <PostFeedbackPanel clientId={clientId} />
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as InstagramTab } })}
        className="space-y-4"
      >
        <TabsList aria-label="Secciones de Instagram">
          <TabsTrigger value="grid">Grid</TabsTrigger>
          <TabsTrigger value="calendario">Calendario</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>
        <TabsContent value="grid">
          <InstagramPage clientId={clientId} />
        </TabsContent>
        <TabsContent value="calendario">
          <ContentCalendar clientId={clientId} />
        </TabsContent>
        <TabsContent value="engagement">
          <EngagementCard clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
