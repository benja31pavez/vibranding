import { createContext, useContext, useEffect, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { IGProfile, IGPost, IGHighlight, IGComment } from "@/components/InstagramEditor";

export interface ActiveClient {
  id: string;
  name: string;
  instagram_handle: string | null;
  business_description: string | null;
}

interface IGData {
  profile: IGProfile | null;
  posts: IGPost[];
  highlights: IGHighlight[];
  comments: IGComment[];
}

interface ClientCtx {
  client: ActiveClient | null;
  ig: IGData;
  setProfile: Dispatch<SetStateAction<IGProfile | null>>;
  setPosts: Dispatch<SetStateAction<IGPost[]>>;
  setHighlights: Dispatch<SetStateAction<IGHighlight[]>>;
  setComments: Dispatch<SetStateAction<IGComment[]>>;
  reloadClient: () => Promise<void>;
  reloadIG: () => Promise<void>;
  /** Error al cargar el cliente (para mostrar reintentar en vez de "Cargando" infinito). */
  clientError: string | null;
  /** Error al cargar los datos de Instagram. */
  igError: string | null;
}

const Ctx = createContext<ClientCtx | null>(null);

export function ClientProvider({ clientId, children }: { clientId: string; children: ReactNode }) {
  const [client, setClient] = useState<ActiveClient | null>(null);
  const [profile, setProfile] = useState<IGProfile | null>(null);
  const [posts, setPosts] = useState<IGPost[]>([]);
  const [highlights, setHighlights] = useState<IGHighlight[]>([]);
  const [comments, setComments] = useState<IGComment[]>([]);
  const [clientError, setClientError] = useState<string | null>(null);
  const [igError, setIgError] = useState<string | null>(null);

  const reloadClient = async () => {
    setClientError(null);
    const { data, error } = await supabase
      .from("clients")
      .select("id,name,instagram_handle,business_description")
      .eq("id", clientId)
      .maybeSingle();
    if (error) {
      setClientError(error.message);
      return;
    }
    setClient(data);
  };

  const reloadIG = async () => {
    const [prRes, psRes, hiRes, cmRes] = await Promise.all([
      supabase.from("instagram_profiles").select("*").eq("client_id", clientId).maybeSingle(),
      supabase
        .from("instagram_posts")
        .select("*")
        .eq("client_id", clientId)
        // Versioned rows are a historical record: keep them even if a past sync archived them.
        .or("archived_at.is.null,version_id.not.is.null"),
      supabase.from("instagram_highlights").select("*").eq("client_id", clientId),
      supabase.from("instagram_post_comments").select("*").eq("client_id", clientId),
    ]);
    const failed = [prRes, psRes, hiRes, cmRes].find((r) => r.error);
    if (failed?.error) {
      setIgError(failed.error.message);
      return;
    }
    setIgError(null);
    const { data: pr } = prRes;
    const { data: ps } = psRes;
    const { data: hi } = hiRes;
    const { data: cm } = cmRes;
    setProfile(pr as IGProfile | null);
    setPosts((ps ?? []) as IGPost[]);
    setHighlights((hi ?? []) as IGHighlight[]);
    setComments((cm ?? []) as IGComment[]);
  };

  useEffect(() => {
    reloadClient();
    reloadIG();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return (
    <Ctx.Provider
      value={{
        client,
        ig: { profile, posts, highlights, comments },
        setProfile,
        setPosts,
        setHighlights,
        setComments,
        reloadClient,
        reloadIG,
        clientError,
        igError,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

/** Como useActiveClient, pero devuelve null fuera de ClientProvider (componentes reutilizables). */
export function useOptionalActiveClient() {
  return useContext(Ctx);
}

export function useActiveClient() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveClient must be used inside ClientProvider");
  return ctx;
}
