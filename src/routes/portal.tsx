import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PortalShell, PortalView, usePortalSnapshot, type PortalMode } from "@/components/portal";
import { NOINDEX_META } from "@/lib/site/robots";
import { resolveClientPanelEnabled } from "@/lib/auth/clientPanel";
import { resolveUserKind } from "@/lib/auth/userKind";

export const Route = createFileRoute("/portal")({
  ssr: false,
  component: ClientPortal,
  head: () => ({
    meta: [
      { title: "Portal del cliente | Vibranding" },
      {
        name: "description",
        content:
          "Aprueba contenidos, revisa tu calendario, tus resultados, pagos y propuestas con Vibranding.",
      },
      { property: "og:title", content: "Portal del cliente | Vibranding" },
      {
        property: "og:description",
        content: "Todo lo de tu marca con Vibranding en un solo lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      NOINDEX_META,
    ],
  }),
});

const CLIENT_MODE: PortalMode = { kind: "client" };

function ClientPortal() {
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  const userId = session?.user?.id;
  const panelCheck = usePanelRedirect(userId);

  if (loading || !session || panelCheck !== "portal") return <div className="min-h-screen bg-bg" />;
  return <AuthedPortal onSignOut={() => void signOut()} />;
}

/**
 * Activación controlada del panel del cliente: si este usuario cliente tiene
 * client_users.panel_enabled, va a /mi. Si no, o si la verificación falla, se
 * queda en el portal (que también es solo del cliente).
 */
function usePanelRedirect(userId: string | undefined): "checking" | "portal" {
  const navigate = useNavigate();
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const stay = () => {
      if (!cancelled) setCheckedUserId(userId);
    };
    resolveUserKind(userId)
      .then(async (kind) => {
        if (kind !== "client") return stay();
        const enabled = await resolveClientPanelEnabled(userId);
        if (cancelled) return;
        if (enabled) navigate({ to: "/mi", replace: true });
        else stay();
      })
      .catch(stay);
    return () => {
      cancelled = true;
    };
  }, [userId, navigate]);
  return userId && checkedUserId === userId ? "portal" : "checking";
}

function AuthedPortal({ onSignOut }: { onSignOut: () => void }) {
  // Misma query que PortalView (se comparte la caché): para el nombre y el logo de la cabecera.
  const snapshot = usePortalSnapshot(CLIENT_MODE);
  const ok = snapshot.data?.status === "ok" ? snapshot.data.snapshot : undefined;
  return (
    <PortalShell
      clientName={ok?.clientName}
      clientId={ok?.clientId}
      logoUrl={ok?.clientLogoUrl}
      onSignOut={onSignOut}
    >
      <PortalView mode={CLIENT_MODE} />
    </PortalShell>
  );
}
