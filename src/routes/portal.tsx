import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PortalShell, PortalView, usePortalSnapshot, type PortalMode } from "@/components/portal";

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
      { name: "robots", content: "noindex" },
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

  if (loading || !session) return <div className="min-h-screen bg-bg" />;
  return <AuthedPortal onSignOut={() => void signOut()} />;
}

function AuthedPortal({ onSignOut }: { onSignOut: () => void }) {
  // Misma query que PortalView (se comparte la caché): solo para el nombre en la cabecera.
  const snapshot = usePortalSnapshot(CLIENT_MODE);
  const clientName = snapshot.data?.status === "ok" ? snapshot.data.snapshot.clientName : undefined;
  return (
    <PortalShell clientName={clientName} onSignOut={onSignOut}>
      <PortalView mode={CLIENT_MODE} />
    </PortalShell>
  );
}
