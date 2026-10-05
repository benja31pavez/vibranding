import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListSkeleton } from "@/components/app";
import { formatChileDate } from "@/lib/proposals/model";
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
      {
        property: "og:description",
        content: "Aprueba o solicita cambios desde tu enlace de revisión.",
      },
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
      console.error("[review] no se pudo cargar el enlace", error);
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
    const ok = (res as { ok?: boolean } | null)?.ok;
    if (error || !ok) {
      toast.error("No se pudo enviar. El enlace puede haber expirado.");
      return;
    }
    toast.success(
      kind === "approval"
        ? "¡Gracias! Entregable aprobado"
        : kind === "change_request"
          ? "Cambios enviados"
          : "Comentario enviado",
    );
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border-subtle bg-sidebar/95">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4 md:h-16 md:px-6">
          <span className="font-brand text-2xl tracking-tight text-gradient-brand bg-gradient-brand-animated">
            Vibranding
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 md:px-6 md:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Revisión de entregable</h1>

        {!data ? (
          <ListSkeleton rows={3} label="Cargando el entregable" />
        ) : !data.ok || !data.deliverable ? (
          <div
            role="alert"
            className="rounded-app-lg border border-border-subtle bg-surface p-6 text-sm text-muted-foreground"
          >
            Este enlace de revisión no es válido o ya expiró. Pide uno nuevo a tu equipo de
            Vibranding.
          </div>
        ) : (
          <>
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="review-name">Tu nombre (opcional)</Label>
              <Input
                id="review-name"
                autoComplete="name"
                maxLength={80}
                placeholder="Así sabemos quién comenta"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <ReviewThread
              deliverable={data.deliverable}
              comments={data.comments ?? []}
              busy={busy}
              onSubmit={submit}
            />
            {data.expires_at && (
              <p className="text-xs text-muted-foreground">
                Este enlace vence el {formatChileDate(data.expires_at)}.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
