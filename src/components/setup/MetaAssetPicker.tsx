import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, ListSkeleton } from "@/components/app";
import { supabase } from "@/integrations/supabase/client";
import { updateMetaAccountAssets, type MetaAssetPatch } from "@/lib/meta/connection.functions";

interface DiscoverIG {
  id: string;
  username: string;
  avatar: string;
  source?: string;
}
interface DiscoverData {
  adAccounts: { id: string; name: string; status: number; business: string }[];
  pages: {
    id: string;
    name: string;
    business: string;
    instagram: { id: string; username: string; avatar: string } | null;
  }[];
  instagramAccounts?: DiscoverIG[];
}

/** Activos que ve el token de Meta del cliente (mismo endpoint que «Autodetectar» en Meta Ads). */
function useMetaDiscover(clientId: string) {
  return useQuery({
    queryKey: ["meta-discover", clientId],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<DiscoverData> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/meta-ads/discover?clientId=${encodeURIComponent(clientId)}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudieron detectar los activos de Meta");
      return json as DiscoverData;
    },
  });
}

type LinkedAssets = { adAccountId: string | null; pageId: string | null; igId: string | null };

/** Ids guardados hoy en la cuenta de Meta del cliente (para marcar el elegido). */
function useLinkedAssets(clientId: string) {
  return useQuery({
    queryKey: ["meta-linked-assets", clientId],
    queryFn: async (): Promise<LinkedAssets> => {
      const { data, error } = await supabase
        .from("meta_accounts")
        .select("ad_account_id,page_id,ig_account_id")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return {
        adAccountId: data?.ad_account_id ?? null,
        pageId: data?.page_id ?? null,
        igId: data?.ig_account_id ?? null,
      };
    },
  });
}

/** Instagram vinculados a páginas + detectados aparte, sin duplicar. */
function mergeInstagram(data: DiscoverData): DiscoverIG[] {
  const merged = new Map<string, DiscoverIG>();
  for (const p of data.pages) {
    if (p.instagram)
      merged.set(p.instagram.id, { ...p.instagram, source: `vinculado a ${p.name}` });
  }
  for (const ig of data.instagramAccounts ?? []) {
    if (!merged.has(ig.id)) merged.set(ig.id, ig);
  }
  return Array.from(merged.values());
}

function OptionRow({
  title,
  detail,
  avatar,
  selected,
  busy,
  onPick,
}: {
  title: string;
  detail: string;
  avatar?: string;
  selected: boolean;
  busy: boolean;
  onPick: () => void;
}) {
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-app-md border p-3 text-sm ${
        selected ? "border-primary bg-primary/5" : "border-border-subtle"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {avatar && <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" />}
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <Button
        size="sm"
        variant={selected ? "secondary" : "outline"}
        disabled={busy || selected}
        onClick={onPick}
      >
        {selected ? (
          <>
            <Check aria-hidden className="mr-1 h-3.5 w-3.5" /> Vinculada
          </>
        ) : (
          "Usar esta"
        )}
      </Button>
    </li>
  );
}

/** Pegar el id a mano cuando Meta no lo lista (mismo guardado que la sección Meta Ads). */
function ManualId({
  label,
  placeholder,
  busy,
  onSave,
}: {
  label: string;
  placeholder: string;
  busy: boolean;
  onSave: (id: string) => void;
}) {
  const [value, setValue] = useState("");
  const id = `manual-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSave(value.trim());
      }}
    >
      <div className="space-y-1">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 w-56 font-mono text-xs"
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={busy || !value.trim()}>
        Guardar
      </Button>
    </form>
  );
}

/**
 * Elige un activo de Meta del cliente: la cuenta publicitaria (y su página) o la
 * cuenta de Instagram. Guarda con la misma acción del servidor que Meta Ads.
 */
export function MetaAssetPicker({
  clientId,
  kind,
  onSaved,
}: {
  clientId: string;
  kind: "ad_account" | "instagram";
  onSaved: () => Promise<void> | void;
}) {
  const discover = useMetaDiscover(clientId);
  const linked = useLinkedAssets(clientId);
  const current: LinkedAssets = linked.data ?? { adAccountId: null, pageId: null, igId: null };
  const saveAssets = useServerFn(updateMetaAccountAssets);
  const [busy, setBusy] = useState(false);

  const save = async (patch: MetaAssetPatch, success: string) => {
    setBusy(true);
    try {
      await saveAssets({ data: { clientId, patch } });
      toast.success(success);
      await Promise.all([linked.refetch(), onSaved()]);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar en Meta");
    } finally {
      setBusy(false);
    }
  };

  const manual =
    kind === "ad_account" ? (
      <ManualId
        label="ID de cuenta publicitaria"
        placeholder="act_1234567890"
        busy={busy}
        onSave={(id) => void save({ ad_account_id: id }, "Cuenta publicitaria guardada")}
      />
    ) : (
      <ManualId
        label="ID de cuenta de Instagram"
        placeholder="178414..."
        busy={busy}
        onSave={(id) => void save({ ig_account_id: id }, "Cuenta de Instagram guardada")}
      />
    );

  if (discover.isLoading) return <ListSkeleton rows={3} label="Buscando activos en Meta" />;
  if (discover.error || !discover.data) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="No pudimos listar los activos de Meta"
          message={(discover.error as Error | null)?.message}
          onRetry={() => void discover.refetch()}
          retrying={discover.isFetching}
        />
        {manual}
      </div>
    );
  }

  const data = discover.data;
  if (kind === "instagram") {
    const list = mergeInstagram(data);
    return (
      <div className="space-y-4">
        {list.length === 0 ? (
          <p className="rounded-app-md border border-dashed border-border-subtle p-3 text-sm text-muted-foreground">
            Meta no muestra cuentas de Instagram. Revisa en Business Settings que la cuenta esté
            asignada al System User con los permisos <code>instagram_basic</code> e{" "}
            <code>instagram_content_publish</code>.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((ig) => (
              <OptionRow
                key={ig.id}
                title={`@${ig.username || ig.id}`}
                detail={`${ig.id}${ig.source ? ` · ${ig.source}` : ""}`}
                avatar={ig.avatar || undefined}
                selected={current.igId === ig.id}
                busy={busy}
                onPick={() =>
                  void save(
                    { ig_account_id: ig.id },
                    `Instagram @${ig.username || ig.id} vinculado`,
                  )
                }
              />
            ))}
          </ul>
        )}
        {manual}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Cuentas publicitarias</h4>
        {data.adAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Meta no muestra cuentas publicitarias.</p>
        ) : (
          <ul className="space-y-2">
            {data.adAccounts.map((a) => (
              <OptionRow
                key={a.id}
                title={a.name}
                detail={`${a.id} · ${a.business} · ${a.status === 1 ? "Activa" : `Estado ${a.status}`}`}
                selected={current.adAccountId === a.id}
                busy={busy}
                onPick={() =>
                  void save(
                    { ad_account_id: a.id, business_name: a.business },
                    `Cuenta ${a.name} vinculada`,
                  )
                }
              />
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Página de Facebook de los anuncios</h4>
        {data.pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Meta no muestra páginas.</p>
        ) : (
          <ul className="space-y-2">
            {data.pages.map((p) => (
              <OptionRow
                key={p.id}
                title={p.name}
                detail={p.id}
                selected={current.pageId === p.id}
                busy={busy}
                onPick={() => void save({ page_id: p.id }, `Página ${p.name} vinculada`)}
              />
            ))}
          </ul>
        )}
      </section>
      {manual}
    </div>
  );
}
