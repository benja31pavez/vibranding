import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ReviewThread,
  type ReviewComment,
  type ReviewDeliverable,
} from "@/components/deliverables/ReviewThread";

export const Route = createFileRoute("/review/$token")({
  ssr: false,
  component: PublicReview,
  head: () => ({
    meta: [
      { title: "Revisión de entregable | Vibranding" },
      {
        name: "description",
        content: "Revisa el entregable, aprueba o solicita cambios con un enlace privado.",
      },
      { property: "og:title", content: "Revisión de entregable | Vibranding" },
      { property: "og:description", content: "Aprueba o solicita cambios desde tu enlace de revisión." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Payload = {
  ok: boolean;
  reason?: string;
  expires_at?: string;
  deliverable?: ReviewDeliverable;
  comments?: ReviewComment[];
};

function PublicReview() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Payload | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: res, error } = await supabase.rpc("review_link_get", { _token: token });
    if (error) {
      setData({ ok: false, reason: "invalid" });
      return;
    }
    setData(res as unknown as Payload);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (kind: ReviewComment["kind"], body: string) => {
    setBusy(true);
    const { data: res, error } = await supabase.rpc("review_link_comment", {
      _token: token,
      _kind: kind,
      _body: body,
      _name: name.trim() || undefined,
    });
    setBusy(false);
    const ok = (res as any)?.ok;
    if (error || !ok) {
      toast.error("No se pudo enviar. El enlace puede haber expirado.");
      return;
    }
    toast.success(
      kind === "approval" ? "¡Gracias! Entregable aprobado" : kind === "change_request" ? "Cambios enviados" : "Comentario enviado",
    );
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-sidebar/95">
        <div className="max-w-3xl mx-auto flex items-center h-16 px-6">
          <span className="font-brand text-2xl tracking-tight text-gradient-brand bg-gradient-brand-animated">
            Vibranding
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight">Revisión de entregable</h1>

        {!data ? (
          <div className="text-muted-foreground text-sm">Cargando…</div>
        ) : !data.ok || !data.deliverable ? (
          <div className="rounded-2xl border bg-surface p-6 text-sm text-muted-foreground">
            Este enlace de revisión no es válido o ya expiró. Pide uno nuevo a tu equipo.
          </div>
        ) : (
          <>
            <div className="max-w-xs">
              <Input placeholder="Tu nombre (opcional)" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <ReviewThread
              deliverable={data.deliverable}
              comments={data.comments ?? []}
              busy={busy}
              onSubmit={submit}
            />
            {data.expires_at && (
              <p className="text-xs text-muted-foreground">
                Este enlace expira el {new Date(data.expires_at).toLocaleDateString()}.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
