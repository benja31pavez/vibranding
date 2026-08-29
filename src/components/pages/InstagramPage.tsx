import { useEffect, useState } from "react";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { IdentityEditor, ConfigEditor, PostsEditor, HighlightsEditor } from "@/components/InstagramEditor";
import { IphonePreview } from "@/components/IphonePreview";
import { InstagramSyncCard } from "@/components/instagram/InstagramSyncCard";


export function InstagramPage({ clientId }: { clientId: string }) {
  const { client, ig, setProfile, setPosts, setHighlights, setComments, reloadIG } = useActiveClient();
  const [view, setView] = useState<"current" | "proposed">("proposed");
  const profile = ig.profile;

  // Prefill IG usernames from the client's saved handle
  useEffect(() => {
    if (!profile || !client?.instagram_handle) return;
    const handle = client.instagram_handle.replace(/^@/, "").trim();
    if (!handle) return;
    const patch: Partial<typeof profile> = {};
    if (!profile.current_username) patch.current_username = handle;
    if (!profile.proposed_username) patch.proposed_username = handle;
    if (Object.keys(patch).length === 0) return;
    setProfile({ ...profile, ...patch });
    supabase.from("instagram_profiles").update(patch).eq("client_id", clientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.instagram_handle, profile?.id]);

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-10">
      <div className="space-y-4">
        <InstagramSyncCard
          clientId={clientId}
          syncedAt={profile?.current_synced_at ?? null}
          onSynced={reloadIG}
        />
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
