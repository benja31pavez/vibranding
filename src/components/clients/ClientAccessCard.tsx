import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, ListSkeleton, Panel } from "@/components/app";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";
import {
  listClientUsers,
  inviteClientUser,
  revokeClientUser,
} from "@/lib/clients/clientAccess.functions";

export interface ClientAccessRow {
  id: string;
  user_id: string;
  email: string | null;
  created_at: string;
}

/** Ayuda del "i" de Acceso del cliente. */
export const CLIENT_ACCESS_INFO =
  "El cliente invitado solo puede ver su analítica, etapas y objetivos. No ve pagos, contratos, otros clientes ni la bandeja de WhatsApp.";

export const clientAccessKey = (userKey: string, clientId: string) =>
  ["ficha", userKey, clientId, "access"] as const;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Personas con acceso al portal de este cliente. */
export function useClientAccess(clientId: string) {
  const userKey = useUserKey();
  const list = useServerFn(listClientUsers);
  return useQuery({
    queryKey: clientAccessKey(userKey, clientId),
    queryFn: async (): Promise<ClientAccessRow[]> => {
      try {
        return (await list({ data: { clientId } })) as ClientAccessRow[];
      } catch (err) {
        throw new Error(errorMessage(err, "No se pudieron cargar los accesos"));
      }
    },
  });
}

/** Invitar y quitar personas del portal del cliente (va en el panel lateral de la ficha). */
export function ClientAccessCard({ clientId }: { clientId: string }) {
  const userKey = useUserKey();
  const queryClient = useQueryClient();
  const invite = useServerFn(inviteClientUser);
  const revoke = useServerFn(revokeClientUser);
  const access = useClientAccess(clientId);
  const rows = access.data ?? [];

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () =>
    queryClient.invalidateQueries({ queryKey: clientAccessKey(userKey, clientId) });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await invite({ data: { clientId, email: email.trim() } });
      setEmail("");
      toast.success(
        "Listo. Si ese correo puede usar el portal, ya tiene acceso. Si no le llega, escríbenos y lo revisamos.",
      );
      void reload();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo invitar"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: ClientAccessRow) => {
    if (!confirm(`¿Quitar el acceso de ${r.email ?? "este usuario"}?`)) return;
    try {
      await revoke({ data: { id: r.id } });
      toast.success("Acceso revocado");
      void reload();
    } catch (err) {
      toast.error(errorMessage(err, "No se pudo revocar"));
    }
  };

  return (
    <Panel title="Acceso del cliente" icon={Users}>
      <form onSubmit={send} className="mb-4 flex flex-wrap gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@cliente.com"
          aria-label="Correo del cliente"
          className="min-w-[220px] flex-1"
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Invitando…" : "Invitar"}
        </Button>
      </form>

      {access.isLoading ? (
        <ListSkeleton rows={2} label="Cargando accesos" />
      ) : access.error ? (
        <ErrorState
          title="No pudimos cargar los accesos"
          message={access.error.message}
          onRetry={() => void access.refetch()}
          retrying={access.isFetching}
        />
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">Todavía no has dado acceso a nadie.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{r.email ?? r.user_id}</span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Revocar acceso de ${r.email ?? r.user_id}`}
                onClick={() => void remove(r)}
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Personas que se muestran en el resumen de la ficha (el resto, en el panel lateral). */
const SUMMARY_LIMIT = 3;

/** Resumen de la ficha: quiénes tienen acceso (hasta 3); invitar y quitar van en el panel lateral. */
export function ClientAccessSummary({ clientId }: { clientId: string }) {
  const access = useClientAccess(clientId);
  if (access.isLoading) return <ListSkeleton rows={1} label="Cargando accesos" />;
  if (access.error) {
    return (
      <ErrorState
        title="No pudimos cargar los accesos"
        message={access.error.message}
        onRetry={() => void access.refetch()}
        retrying={access.isFetching}
      />
    );
  }
  const rows = access.data ?? [];
  const extra = rows.length - SUMMARY_LIMIT;
  return rows.length === 0 ? (
    <p className="text-sm text-muted-foreground">Todavía no has dado acceso a nadie.</p>
  ) : (
    <ul className="space-y-0.5 text-sm">
      {rows.slice(0, SUMMARY_LIMIT).map((r) => (
        <li key={r.id} className="truncate">
          {r.email ?? r.user_id}
        </li>
      ))}
      {extra > 0 && <li className="text-xs text-muted-foreground">y {extra} más</li>}
    </ul>
  );
}
