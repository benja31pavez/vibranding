import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen" />;
  return <Navigate to={session ? "/clients" : "/login"} />;
}
