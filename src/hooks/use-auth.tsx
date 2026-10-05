import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ session: null, user: null, loading: true, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // El SDK de Supabase se carga aparte para que no pese en el primer render de las páginas públicas.
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    void import("@/integrations/supabase/client")
      .then(({ supabase }) => {
        if (cancelled) return undefined;
        const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
          // Al cerrar sesión (también desde otra pestaña) no deben quedar datos cacheados del usuario anterior.
          if (event === "SIGNED_OUT") queryClient.clear();
          setSession(s);
        });
        unsubscribe = () => sub.subscription.unsubscribe();
        return supabase.auth.getSession().then(({ data }) => {
          if (cancelled) return;
          setSession(data.session);
          setLoading(false);
        });
      })
      .catch((err: unknown) => {
        console.error("[auth] no se pudo iniciar la sesión", err);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient]);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signOut: async () => {
          const { supabase } = await import("@/integrations/supabase/client");
          await supabase.auth.signOut();
          queryClient.clear();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
