import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/clients" });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Cuenta creada");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message ?? "Error");
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
          <Link to="/" className="inline-block mb-8">
            <span className="text-4xl md:text-5xl font-bold italic tracking-tight text-gradient-brand bg-gradient-brand-animated">Vibranding</span>
          </Link>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card/70 backdrop-blur border text-xs font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-gradient-brand" /> Para diseñadores
          </div>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.05]">
            Propuestas que <span className="font-brand text-gradient-brand bg-gradient-brand-animated">vibran</span>.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Objetivos, entregables, propuestas de Instagram y pagos. Todo de un cliente, en un solo lugar.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <Link to="/" className="lg:hidden inline-block">
            <span className="text-3xl font-bold italic tracking-tight text-gradient-brand bg-gradient-brand-animated">Vibranding</span>
          </Link>
          <div>
            <h2 className="text-2xl font-semibold">{mode === "signin" ? "Inicia sesión" : "Crea tu cuenta"}</h2>
            <p className="text-sm text-muted-foreground mt-1">Tu plataforma de asesorías.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy} className="w-full rounded-full h-11">
            {busy ? "..." : mode === "signin" ? "Entrar" : "Crear cuenta"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "¿No tienes cuenta? Crear una" : "¿Ya tienes cuenta? Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
