import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { NOINDEX_META } from "@/lib/site/robots";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Vibranding" },
      {
        name: "description",
        content: "Accede a tu panel de Vibranding para gestionar clientes, contenido y campañas.",
      },
      NOINDEX_META,
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data: cid } = await supabase.rpc("user_client_id");
      navigate({ to: cid ? "/portal" : "/clients" });
    })();
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent(true);
        toast.success("Te enviamos un correo de recuperación");
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message ?? "Error");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result?.error) throw result.error;
    } catch (err: any) {
      toast.error(err.message ?? "No se pudo iniciar con Google");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-secondary to-background relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[color:var(--brand-1)]/30 blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-[24rem] h-[24rem] rounded-full bg-[color:var(--brand-2)]/25 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-[color:var(--brand-3)]/25 blur-3xl" />
        <div className="relative max-w-md px-12">
          <h1 className="text-4xl md:text-5xl font-semibold leading-[1.1] tracking-tight">
            En{" "}
            <Link
              to="/"
              className="font-bold italic text-gradient-brand bg-gradient-brand-animated"
            >
              Vibranding
            </Link>{" "}
            hacemos que tu marca vibre.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Objetivos, publicaciones, optimización, publicidad y pagos, todo en un solo lugar.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <Link to="/" className="lg:hidden inline-block">
            <span className="text-3xl font-bold italic tracking-tight text-gradient-brand bg-gradient-brand-animated">
              Vibranding
            </span>
          </Link>
          <div>
            <h2 className="text-2xl font-semibold">
              {mode === "forgot" ? "Recuperar contraseña" : "Inicia sesión"}
            </h2>
            {mode === "forgot" && (
              <p className="mt-1 text-sm text-muted-foreground">
                Te enviaremos un enlace para crear una nueva contraseña.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {mode === "login" && (
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
          <Button type="submit" disabled={busy} className="w-full rounded-full h-11">
            {busy ? "..." : mode === "forgot" ? "Enviar enlace" : "Entrar"}
          </Button>
          {sent && mode === "forgot" && (
            <p className="text-center text-sm text-muted-foreground">
              Revisa tu correo y abre el enlace para crear tu nueva contraseña.
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "forgot" ? "login" : "forgot");
              setSent(false);
            }}
            className="w-full text-center text-sm text-muted-foreground underline hover:text-foreground"
          >
            {mode === "forgot" ? "Volver a iniciar sesión" : "¿Olvidaste tu contraseña?"}
          </button>
          {mode === "login" && (
            <>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">o</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={google}
                className="w-full rounded-full h-11 gap-2"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2a7 7 0 0 1-6.6-4.8H1.4v3.1A12 12 0 0 0 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.4 14.5a7.2 7.2 0 0 1 0-4.6V6.8H1.4a12 12 0 0 0 0 10.8l4-3.1Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.8l4 3.1A7 7 0 0 1 12 4.8Z"
                  />
                </svg>
                Continuar con Google
              </Button>
            </>
          )}
          <p className="text-center text-sm text-muted-foreground">
            ¿Necesitas acceso? Contacta al administrador.
          </p>
        </form>
      </div>
    </div>
  );
}
