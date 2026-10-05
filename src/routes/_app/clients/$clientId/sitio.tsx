import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultilinkPage } from "@/components/pages/MultilinkPage";
import { LandingEditor } from "@/components/pages/LandingEditor";
import { UnsavedChangesGuard } from "@/components/site/SaveStatus";
import { useState } from "react";

export const Route = createFileRoute("/_app/clients/$clientId/sitio")({
  validateSearch: (s: Record<string, unknown>): { tab?: "multienlace" | "landing" } => ({
    tab: s.tab === "landing" ? "landing" : s.tab === "multienlace" ? "multienlace" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sitio del cliente | Vibranding" },
      { name: "description", content: "Multienlace y landing page del cliente en un solo lugar." },
      { property: "og:title", content: "Sitio del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Multienlace y landing page del cliente en un solo lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SitioPage,
});

function SitioPage() {
  const { clientId } = Route.useParams();
  const { tab = "multienlace" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [dirtyMultilink, setDirtyMultilink] = useState(false);
  const [dirtyLanding, setDirtyLanding] = useState(false);

  return (
    <>
      <UnsavedChangesGuard dirty={dirtyMultilink || dirtyLanding} />
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as "multienlace" | "landing" } })}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="multienlace">
            Multienlace
            {dirtyMultilink && <DirtyDot />}
          </TabsTrigger>
          <TabsTrigger value="landing">
            Landing page
            {dirtyLanding && <DirtyDot />}
          </TabsTrigger>
        </TabsList>
        {/* forceMount: cambiar de pestaña no desmonta el editor ni pierde cambios sin guardar. */}
        <TabsContent value="multienlace" forceMount className="data-[state=inactive]:hidden">
          <MultilinkPage clientId={clientId} onDirtyChange={setDirtyMultilink} />
        </TabsContent>
        <TabsContent value="landing" forceMount className="data-[state=inactive]:hidden">
          <LandingEditor clientId={clientId} onDirtyChange={setDirtyLanding} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function DirtyDot() {
  return (
    <span
      className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-500"
      aria-label="con cambios sin guardar"
    />
  );
}
