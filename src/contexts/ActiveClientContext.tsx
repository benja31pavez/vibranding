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
}

const Ctx = createContext<ClientCtx | null>(null);

export function ClientProvider({ clientId, children }: { clientId: string; children: ReactNode }) {
  const [client, setClient] = useState<ActiveClient | null>(null);
  const [profile, setProfile] = useState<IGProfile | null>(null);
  const [posts, setPosts] = useState<IGPost[]>([]);
  const [highlights, setHighlights] = useState<IGHighlight[]>([]);
  const [comments, setComments] = useState<IGComment[]>([]);

  const reloadClient = async () => {
    const { data } = await supabase
      .from("clients")
      .select("id,name,instagram_handle")
      .eq("id", clientId)
      .maybeSingle();
    setClient(data);
  };

  const reloadIG = async () => {
    const [{ data: pr }, { data: ps }, { data: hi }, { data: cm }] = await Promise.all([
      supabase.from("instagram_profiles").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("instagram_posts").select("*").eq("client_id", clientId),
      supabase.from("instagram_highlights").select("*").eq("client_id", clientId),
      supabase.from("instagram_post_comments").select("*").eq("client_id", clientId),
    ]);
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
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useActiveClient() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveClient must be used inside ClientProvider");
  return ctx;
}
