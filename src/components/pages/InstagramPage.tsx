import { useCallback, useEffect, useState } from "react";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ErrorState } from "@/components/app";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { IdentityEditor, ConfigEditor, PostsEditor, HighlightsEditor } from "@/components/InstagramEditor";
import { IphonePreview } from "@/components/IphonePreview";
import { GridVersionBar } from "@/components/instagram/GridVersionBar";
import { VersionGrid } from "@/components/instagram/VersionGrid";
import { VersionCompare } from "@/components/instagram/VersionCompare";
import { loadGridVersions, type GridVersion } from "@/lib/instagram/gridVersions";

type View = "current" | "proposed" | "compare";

export function InstagramPage({ clientId }: { clientId: string }) {
  const { client, ig, setProfile, setPosts, setHighlights, setComments, reloadIG, igError } = useActiveClient();
  const [view, setView] = useState<View>("proposed");
  const [versions, setVersions] = useState<GridVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const profile = ig.profile;

  const refreshVersions = useCallback(
    async (selectId?: string) => {
      const rows = await loadGridVersions(clientId);
      setVersions(rows);
      const newest = rows.find((v) => !v.is_baseline) ?? rows[0] ?? null;
      setSelectedId((prev) => selectId ?? (prev && rows.some((v) => v.id === prev) ? prev : newest?.id ?? null));
      const baseline = rows.find((v) => v.is_baseline) ?? rows[rows.length - 1] ?? null;
      setLeftId((prev) => (prev && rows.some((v) => v.id === prev) ? prev : baseline?.id ?? null));
      setRightId((prev) => (prev && rows.some((v) => v.id === prev) ? prev : newest?.id ?? null));
      await reloadIG();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clientId],
  );

  useEffect(() => {
    void refreshVersions();
  }, [refreshVersions]);

  // Prefill IG usernames from the client's saved handle
  useEffect(() => {
    if (!profile || !client?.instagram_handle) return;
    const handle = client.instagram_handle.replace(/^@/, "").trim();
    if (!handle) return;
    const patch: Partial<typeof profile> = {};
    if (!profile.current_username) patch.current_username = handle;
    if (!profile.proposed_username) patch.proposed_username = handle;
    if (Object.keys(patch).length === 0) return;
    const previous = profile;
    setProfile({ ...profile, ...patch });
    void (async () => {
      // Sin await la petición de Supabase nunca se ejecuta (el builder es "lazy").
      const { data, error } = await supabase
        .from("instagram_profiles")
        .update(patch)
        .eq("client_id", clientId)
        .select("id");
      if (error || !data || data.length === 0) {
        setProfile(previous);
        toast.error(
          error
            ? `No se pudo guardar el usuario de Instagram: ${error.message}`
            : "No se pudo guardar el usuario de Instagram (sin permisos)",
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.instagram_handle, profile?.id]);

  const selected = versions.find((v) => v.id === selectedId) ?? null;
  const newest = versions.find((v) => !v.is_baseline) ?? null;
  // A brand-new manual version is a work in progress until the next one exists.
  const versionEditable =
    !!selected && !selected.is_baseline && selected.source === "manual" && selected.id === newest?.id;

  const previewPosts =
    view === "proposed"
      ? ig.posts.filter((p) => !p.version_id)
      : ig.posts.filter((p) => p.version_id === selectedId);

  if (igError) {
    return (
      <ErrorState
        title="No pudimos cargar los datos de Instagram"
        message={igError}
        onRetry={() => void reloadIG()}
      />
    );
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-10">
      <div className="space-y-4">
        {view !== "proposed" && (
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Actual · sincronizado desde Instagram</strong> — el
            estado real de la cuenta, guardado por fecha. Es una pista aparte de la propuesta.
          </p>
        )}
        {view !== "proposed" && (
          <GridVersionBar
            clientId={clientId}
            versions={versions}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChanged={(id) => void refreshVersions(id)}
            editable={versionEditable}
          />
        )}

        {view === "compare" ? (
          <VersionCompare
            clientId={clientId}
            posts={ig.posts}
            versions={versions}
            leftId={leftId}
            rightId={rightId}
            onLeft={setLeftId}
            onRight={setRightId}
          />
        ) : view === "current" ? (
          versions.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-xl border bg-surface px-4 py-6 text-center">
              Todavía no hay versiones del grid Actual. Crea la primera con "Capturar estado actual"
              o "Subir manualmente".
            </p>
          ) : versionEditable ? (
            <div className="border rounded-xl bg-surface px-4 py-3">
              <PostsEditor
                clientId={clientId}
                posts={ig.posts}
                setPosts={setPosts}
                type="current"
                profile={profile}
                setProfile={setProfile}
                comments={ig.comments}
                setComments={setComments}
                versionId={selectedId}
              />
            </div>
          ) : (
            <VersionGrid clientId={clientId} posts={previewPosts} />
          )
        ) : (
          profile && (
            <>
              <p className="text-xs text-muted-foreground">
                <strong className="text-accent">Propuesta · plan editable</strong> — tu plan de
                contenido. Vive en una pista aparte del grid Actual sincronizado.
              </p>
              <Accordion type="single" collapsible defaultValue="identity" className="w-full space-y-2">
                <AccordionItem value="identity" className="border rounded-xl bg-surface px-4">
                  <AccordionTrigger className="text-base font-semibold hover:no-underline">Identidad</AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <IdentityEditor profile={profile} setProfile={setProfile} clientId={clientId} side="proposed" />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="config" className="border rounded-xl bg-surface px-4">
                  <AccordionTrigger className="text-base font-semibold hover:no-underline">Configuración</AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <ConfigEditor profile={profile} setProfile={setProfile} side="proposed" />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="highlights" className="border rounded-xl bg-surface px-4">
                  <AccordionTrigger className="text-base font-semibold hover:no-underline">Historias destacadas</AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <HighlightsEditor clientId={clientId} highlights={ig.highlights} setHighlights={setHighlights} type="proposed" />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="posts" className="border rounded-xl bg-surface px-4">
                  <AccordionTrigger className="text-base font-semibold hover:no-underline">Publicaciones</AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <PostsEditor clientId={clientId} posts={ig.posts} setPosts={setPosts} type="proposed" profile={profile} setProfile={setProfile} comments={ig.comments} setComments={setComments} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </>
          )
        )}
      </div>

      <div className="lg:sticky lg:top-8 lg:self-start space-y-3">
        <div className="flex justify-center gap-1 bg-secondary rounded-full p-1 max-w-[340px] mx-auto">
          {([
            ["current", "Actual"],
            ["proposed", "Propuesta"],
            ["compare", "Comparar"],
          ] as [View, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 text-xs py-1.5 px-3 rounded-full font-medium transition-colors ${
                view === v ? "bg-surface shadow-sm" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {profile && view !== "compare" && (
          <IphonePreview
            profile={profile}
            posts={previewPosts}
            highlights={ig.highlights}
            comments={ig.comments}
            view={view === "proposed" ? "proposed" : "current"}
          />
        )}
      </div>
    </div>
  );
}
