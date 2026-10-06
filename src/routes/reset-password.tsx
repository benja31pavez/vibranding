import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NOINDEX_META } from "@/lib/site/robots";
import { authErrorMessage } from "@/lib/auth/authErrors";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Crear nueva contraseña — Vibranding" },
      { name: "description", content: "Define una nueva contraseña para tu cuenta de Vibranding." },
      NOINDEX_META,
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  // Evita mostrar "abre el enlace del correo" antes de saber si hay sesión.
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) setReady(true);
    });
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) setReady(true);
      })
      .catch((err) => console.error("[reset-password] getSession falló", err))
      .finally(() => setChecked(true));
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Las contraseñas no coinciden. Escríbelas de nuevo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      toast.success("Listo, guardamos tu nueva contraseña");
      // Clientes van a su portal; el equipo, al panel (igual que en /login).
      const { data: clientId } = await supabase.rpc("user_client_id");
      navigate({ to: clientId ? "/portal" : "/clients" });
    } catch (err) {
      console.error("[reset-password] no se pudo guardar", err);
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <Link to="/" className="inline-block">
          <span className="font-brand text-3xl tracking-tight text-gradient-brand bg-gradient-brand-animated">
            Vibranding
          </span>
        </Link>
        <h1 className="text-2xl font-semibold">Crear nueva contraseña</h1>
        {checked && !ready && (
          <p className="text-sm text-muted-foreground">
            Abre esta página desde el enlace del correo de recuperación. Si el enlace expiró,{" "}
            <Link to="/login" className="underline">
              solicita uno nuevo
            </Link>
            .
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="password">Nueva contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Repetir contraseña</Label>
          <Input
            id="confirm"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">Usa al menos 6 caracteres.</p>
        {error && (
          <p
            role="alert"
            className="rounded-app-md bg-danger-subtle px-3 py-2 text-sm text-danger-strong"
          >
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !ready} className="w-full rounded-full h-11">
          {busy && <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />}
          {busy ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </div>
  );
}
