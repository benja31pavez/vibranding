import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Users, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listClientUsers,
  inviteClientUser,
  revokeClientUser,
} from "@/lib/clients/clientAccess.functions";

interface Row {
  id: string;
  user_id: string;
  email: string | null;
  created_at: string;
}

export function ClientAccessCard({ clientId }: { clientId: string }) {
  const list = useServerFn(listClientUsers);
  const invite = useServerFn(inviteClientUser);
  const revoke = useServerFn(revokeClientUser);

  const [rows, setRows] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const load = async () => {
    try {
      setRows((await list({ data: { clientId } })) as Row[]);
    } catch {
      /* sin permisos o sin accesos */
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setLink(null);
    try {
      const res = await invite({ data: { clientId, email: email.trim() } });
      setEmail("");
      setLink(res.inviteLink ?? null);
      toast.success(
        res.inviteLink
          ? "Acceso creado. Comparte el enlace de invitación."
          : "Invitación enviada por correo",
      );
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo invitar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-surface p-5">
      <div className="flex items-center gap-2 text-sm font-medium mb-1">
        <Users className="w-4 h-4" /> Acceso del cliente
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        El cliente invitado solo puede ver su analítica, etapas y objetivos. No ve pagos,
        contratos, otros clientes ni la bandeja de WhatsApp.
      </p>

      <form onSubmit={send} className="flex flex-wrap gap-2 mb-4">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@cliente.com"
          className="flex-1 min-w-[220px]"
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Invitando…" : "Invitar"}
        </Button>
      </form>

      {link && (
        <div className="mb-4 rounded-xl border border-dashed p-3 text-xs break-all">
          <div className="font-medium mb-1">Enlace de invitación</div>
          {link}
          <Button
            size="sm"
            variant="ghost"
            className="mt-1"
            onClick={() => {
              navigator.clipboard.writeText(link);
              toast.success("Enlace copiado");
            }}
          >
            <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">Todavía no has dado acceso a nadie.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{r.email ?? r.user_id}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await revoke({ data: { id: r.id } });
                    toast.success("Acceso revocado");
                    load();
                  } catch (err: any) {
                    toast.error(err?.message ?? "No se pudo revocar");
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
