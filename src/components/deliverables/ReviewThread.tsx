import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download, Paperclip, RotateCcw, ThumbsUp } from "lucide-react";

export type ReviewComment = {
  id: string;
  kind: "comment" | "approval" | "change_request";
  body: string;
  author_role: "agency" | "client" | "guest";
  author_name: string | null;
  created_at: string;
};

export type ReviewDeliverable = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  file_url: string | null;
  file_name: string | null;
  mime_type: string | null;
};

const KIND_LABEL: Record<ReviewComment["kind"], string> = {
  comment: "Comentario",
  approval: "Aprobación",
  change_request: "Cambios solicitados",
};

const ROLE_LABEL: Record<ReviewComment["author_role"], string> = {
  agency: "Agencia",
  client: "Cliente",
  guest: "Invitado",
};

/** Read-only file view + comment thread with approve / request-changes actions. */
export function ReviewThread({
  deliverable,
  comments,
  busy,
  onSubmit,
}: {
  deliverable: ReviewDeliverable;
  comments: ReviewComment[];
  busy?: boolean;
  onSubmit: (kind: ReviewComment["kind"], body: string) => Promise<void> | void;
}) {
  const [body, setBody] = useState("");
  const isImage = (deliverable.mime_type ?? "").startsWith("image/");
  const done = deliverable.status === "done";

  const send = async (kind: ReviewComment["kind"], text: string) => {
    await onSubmit(kind, text);
    setBody("");
  };

  return (
    <div className="rounded-2xl border bg-surface p-5 space-y-4">
      <div>
        <div className="font-medium">{deliverable.title}</div>
        {deliverable.description && (
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{deliverable.description}</p>
        )}
      </div>

      {deliverable.file_url ? (
        isImage ? (
          <a href={deliverable.file_url} target="_blank" rel="noreferrer" className="block">
            <img
              src={deliverable.file_url}
              alt={deliverable.file_name ?? deliverable.title}
              loading="lazy"
              className="rounded-xl border max-h-[420px] w-auto"
            />
          </a>
        ) : (
          <a
            href={deliverable.file_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-secondary/50"
          >
            <Paperclip className="w-4 h-4" />
            {deliverable.file_name ?? "Archivo adjunto"}
            <Download className="w-4 h-4 text-muted-foreground" />
          </a>
        )
      ) : (
        <div className="text-sm text-muted-foreground">Sin archivo adjunto.</div>
      )}

      <div className="space-y-2">
        {comments.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">Sin comentarios todavía.</div>
        ) : (
          comments.map((c) => {
            const tone =
              c.kind === "approval"
                ? "border-success/40 bg-success/5"
                : c.kind === "change_request"
                  ? "border-warning/40 bg-warning/5"
                  : "border-border bg-secondary/30";
            return (
              <div key={c.id} className={`rounded-xl border ${tone} px-3 py-2`}>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  {KIND_LABEL[c.kind]} · {c.author_name || ROLE_LABEL[c.author_role]} ·{" "}
                  {new Date(c.created_at).toLocaleString()}
                </div>
                <div className="text-sm mt-1 whitespace-pre-wrap">{c.body}</div>
              </div>
            );
          })
        )}
      </div>

      {done ? (
        <div className="text-sm text-success">Este entregable ya está aprobado.</div>
      ) : (
        <>
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escribe un comentario o describe los cambios que necesitas…"
            className="text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="rounded-full bg-success text-success-foreground hover:bg-success/90"
              disabled={busy}
              onClick={() => send("approval", body.trim() || "Aprobado ✓")}
            >
              <ThumbsUp className="w-4 h-4 mr-1" /> Aprobar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={busy || !body.trim()}
              onClick={() => send("change_request", body)}
            >
              <RotateCcw className="w-4 h-4 mr-1" /> Pedir cambios
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              disabled={busy || !body.trim()}
              onClick={() => send("comment", body)}
            >
              Comentar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
