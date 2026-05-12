import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { IdentityEditor, ConfigEditor, PostsEditor, HighlightsEditor } from "@/components/InstagramEditor";
import { IphonePreview } from "@/components/IphonePreview";

export const Route = createFileRoute("/_app/clients/$clientId/instagram")({
  component: InstagramPage,
});

function InstagramPage() {
  const { clientId } = Route.useParams();
  const { ig, setProfile, setPosts, setHighlights, setComments } = useActiveClient();
  const [view, setView] = useState<"current" | "proposed">("proposed");
  const profile = ig.profile;

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-10">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Editando vista <strong className={view === "proposed" ? "text-accent" : ""}>{view === "proposed" ? "Propuesta" : "Actual"}</strong>. Cambia con el selector del iPhone.
        </p>
        {profile && (
          <Accordion type="single" collapsible defaultValue="identity" className="w-full space-y-2">
            <AccordionItem value="identity" className="border rounded-xl bg-surface px-4">
              <AccordionTrigger className="text-base font-semibold hover:no-underline">Identidad</AccordionTrigger>
              <AccordionContent className="pt-2">
                <IdentityEditor profile={profile} setProfile={setProfile} clientId={clientId} side={view} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="config" className="border rounded-xl bg-surface px-4">
              <AccordionTrigger className="text-base font-semibold hover:no-underline">Configuración</AccordionTrigger>
              <AccordionContent className="pt-2">
                <ConfigEditor profile={profile} setProfile={setProfile} side={view} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="highlights" className="border rounded-xl bg-surface px-4">
              <AccordionTrigger className="text-base font-semibold hover:no-underline">Historias destacadas</AccordionTrigger>
              <AccordionContent className="pt-2">
                <HighlightsEditor clientId={clientId} highlights={ig.highlights} setHighlights={setHighlights} type={view} />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="posts" className="border rounded-xl bg-surface px-4">
              <AccordionTrigger className="text-base font-semibold hover:no-underline">Publicaciones</AccordionTrigger>
              <AccordionContent className="pt-2">
                <PostsEditor clientId={clientId} posts={ig.posts} setPosts={setPosts} type={view} profile={profile} setProfile={setProfile} comments={ig.comments} setComments={setComments} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>

      <div className="lg:sticky lg:top-8 lg:self-start space-y-3">
        <div className="flex justify-center gap-1 bg-secondary rounded-full p-1 max-w-[260px] mx-auto">
          <button onClick={() => setView("current")} className={`flex-1 text-xs py-1.5 px-3 rounded-full font-medium transition-colors ${view === "current" ? "bg-surface shadow-sm" : "text-muted-foreground"}`}>
            Actual
          </button>
          <button onClick={() => setView("proposed")} className={`flex-1 text-xs py-1.5 px-3 rounded-full font-medium transition-colors ${view === "proposed" ? "bg-surface shadow-sm" : "text-muted-foreground"}`}>
            Propuesta
          </button>
        </div>
        {profile && <IphonePreview profile={profile} posts={ig.posts} highlights={ig.highlights} comments={ig.comments} view={view} />}
      </div>
    </div>
  );
}
