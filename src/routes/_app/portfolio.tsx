import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Upload,
  ImageIcon,
  Save,
  Loader2,
  ExternalLink,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import type { PortfolioClient, PortfolioWork } from "@/lib/portfolio";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageContainer,
  PageHeader,
} from "@/components/app";

export const Route = createFileRoute("/_app/portfolio")({
  component: PortfolioAdminPage,
  head: () => ({
    meta: [
      { title: "Portafolio público · Vibranding" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type ClientWithWorks = PortfolioClient & { works: PortfolioWork[] };

const BUCKET = "client-media";

async function uploadToBucket(file: File, userId: string, kind: "logo" | "work") {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `portfolio/${userId}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function PortfolioAdminPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ClientWithWorks[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ClientWithWorks | null>(null);

  const load = useCallback(async () => {
    const [clientsRes, worksRes] = await Promise.all([
      supabase
        .from("portfolio_clients")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("portfolio_works")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);
    const error = clientsRes.error ?? worksRes.error;
    if (error) {
      console.error("[portfolio] error al cargar", error);
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const clients = clientsRes.data;
    const works = worksRes.data;
    setLoadError(null);
    const grouped: ClientWithWorks[] = ((clients as PortfolioClient[]) ?? []).map((c) => ({
      ...c,
      works: ((works as PortfolioWork[]) ?? []).filter((w) => w.portfolio_client_id === c.id),
    }));
    setItems(grouped);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addClient = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("portfolio_clients")
      .insert({ user_id: user.id, name: "Nuevo cliente", sort_order: items.length })
      .select()
      .single();
    if (error) {
      toast.error("Error", { description: error.message });
      return;
    }
    setItems((prev) => [...prev, { ...(data as PortfolioClient), works: [] }]);
  };

  const removeClient = async (id: string) => {
    const { error } = await supabase.from("portfolio_clients").delete().eq("id", id);
    if (error) {
      toast.error("Error", { description: error.message });
      return;
    }
    setItems((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <PageContainer>
      <PageHeader
        title="Portafolio público"
        description="Clientes y trabajos que se muestran en el landing."
        actions={
          <Button onClick={addClient} disabled={loading || Boolean(loadError)}>
            <Plus aria-hidden className="w-4 h-4 mr-1" /> Añadir cliente
          </Button>
        }
      />

      {loading ? (
        <ListSkeleton rows={3} label="Cargando portafolio" className="mt-8" />
      ) : loadError ? (
        <ErrorState
          className="mt-8"
          message={loadError}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={ImageIcon}
          title="Aún no tienes clientes en tu portafolio."
          description="Añade un cliente y sube imágenes de los trabajos que quieres mostrar en el landing."
        />
      ) : (
        <div className="mt-8 space-y-6">
          {items.map((c) => (
            <ClientCard
              key={c.id}
              userId={user?.id ?? ""}
              client={c}
              onDelete={() => setToDelete(c)}
              onReload={load}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => {
          if (!o) setToDelete(null);
        }}
        title="¿Eliminar este cliente del portafolio?"
        description={`Se borran «${toDelete?.name ?? ""}» y todos sus trabajos del landing. No se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (toDelete) void removeClient(toDelete.id);
          setToDelete(null);
        }}
      />
    </PageContainer>
  );
}

function ClientCard({
  userId,
  client,
  onDelete,
  onReload,
}: {
  userId: string;
  client: ClientWithWorks;
  onDelete: () => void;
  onReload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(client);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(client);
  }, [client]);

  const dirty =
    JSON.stringify({ ...draft, works: undefined }) !==
    JSON.stringify({ ...client, works: undefined });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("portfolio_clients")
      .update({
        name: draft.name,
        logo_url: draft.logo_url,
        description: draft.description,
        website_url: draft.website_url,
        industry: draft.industry,
        sort_order: draft.sort_order,
        is_visible: draft.is_visible,
      })
      .eq("id", draft.id);
    setSaving(false);
    if (error) {
      toast.error("Error", { description: error.message });
    } else {
      toast.success("Guardado");
      await onReload();
    }
  };

  const onLogoFile = async (file: File) => {
    if (!userId) return;
    setUploadingLogo(true);
    try {
      const url = await uploadToBucket(file, userId, "logo");
      setDraft((d) => ({ ...d, logo_url: url }));
    } catch (e: any) {
      toast.error("Error al subir", { description: e.message });
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-4">
        <GripVertical className="w-4 h-4 mt-2 text-muted-foreground/50" />

        {/* Logo */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="relative w-20 h-20 rounded-2xl border border-dashed bg-muted/40 overflow-hidden flex items-center justify-center hover:border-primary transition-colors"
          >
            {uploadingLogo ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : draft.logo_url ? (
              <img src={draft.logo_url} alt={draft.name} className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
            )}
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onLogoFile(f);
              e.target.value = "";
            }}
          />
        </div>

        {/* Fields */}
        <div className="flex-1 min-w-0 grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Nombre</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Sector</Label>
            <Input
              value={draft.industry ?? ""}
              onChange={(e) => setDraft({ ...draft, industry: e.target.value })}
              placeholder="Restaurante, moda…"
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Descripción corta</Label>
            <Input
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Sitio web</Label>
            <Input
              value={draft.website_url ?? ""}
              onChange={(e) => setDraft({ ...draft, website_url: e.target.value })}
              placeholder="https://…"
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-xs">Orden</Label>
            <Input
              type="number"
              className="w-24"
              value={draft.sort_order}
              onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="flex items-center gap-3 justify-end">
            <Label htmlFor={`vis-${draft.id}`} className="text-xs">
              Visible en landing
            </Label>
            <Switch
              id={`vis-${draft.id}`}
              checked={draft.is_visible}
              onCheckedChange={(v) => setDraft({ ...draft, is_visible: v })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4 mr-1" /> Guardar
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            aria-label="Eliminar cliente del portafolio"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="mt-6 pt-5 border-t">
        <WorksManager
          userId={userId}
          clientId={client.id}
          works={client.works}
          onChange={onReload}
        />
      </div>
    </div>
  );
}

function WorksManager({
  userId,
  clientId,
  works,
  onChange,
}: {
  userId: string;
  clientId: string;
  works: PortfolioWork[];
  onChange: () => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadWorks = async (files: FileList | null) => {
    if (!files || files.length === 0 || !userId) return;
    setUploading(true);
    try {
      const rows = [];
      for (const file of Array.from(files)) {
        const url = await uploadToBucket(file, userId, "work");
        rows.push({
          user_id: userId,
          portfolio_client_id: clientId,
          image_url: url,
          sort_order: works.length + rows.length,
        });
      }
      const { error } = await supabase.from("portfolio_works").insert(rows);
      if (error) throw error;
      await onChange();
      toast.success(`${rows.length} trabajo(s) añadido(s)`);
    } catch (e: any) {
      toast.error("Error al subir", { description: e.message });
    } finally {
      setUploading(false);
    }
  };

  const updateWork = async (id: string, patch: Partial<PortfolioWork>) => {
    const { error } = await supabase.from("portfolio_works").update(patch).eq("id", id);
    if (error) {
      toast.error("Error", { description: error.message });
    } else {
      await onChange();
    }
  };

  const [workToDelete, setWorkToDelete] = useState<string | null>(null);

  const removeWork = async (id: string) => {
    const { error } = await supabase.from("portfolio_works").delete().eq("id", id);
    if (error) {
      toast.error("Error", { description: error.message });
    } else {
      await onChange();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">Trabajos ({works.length})</div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Upload className="w-4 h-4 mr-1" /> Subir imágenes
            </>
          )}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void uploadWorks(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {works.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sube imágenes de los trabajos realizados para este cliente.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {works.map((w) => (
            <WorkCard
              key={w.id}
              work={w}
              onUpdate={(patch) => updateWork(w.id, patch)}
              onDelete={() => setWorkToDelete(w.id)}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={workToDelete !== null}
        onOpenChange={(o) => {
          if (!o) setWorkToDelete(null);
        }}
        title="¿Eliminar este trabajo?"
        description="La imagen deja de mostrarse en el landing. No se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (workToDelete) void removeWork(workToDelete);
          setWorkToDelete(null);
        }}
      />
    </div>
  );
}

function WorkCard({
  work,
  onUpdate,
  onDelete,
}: {
  work: PortfolioWork;
  onUpdate: (patch: Partial<PortfolioWork>) => Promise<void>;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(work);
  useEffect(() => {
    setDraft(work);
  }, [work]);
  const dirty =
    draft.title !== work.title ||
    draft.description !== work.description ||
    draft.link_url !== work.link_url ||
    draft.is_visible !== work.is_visible;

  return (
    <div className="rounded-xl border bg-background overflow-hidden flex flex-col">
      {work.image_url ? (
        <div className="aspect-[4/5] bg-muted overflow-hidden">
          <img src={work.image_url} alt={work.title ?? ""} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-[4/5] bg-gradient-brand opacity-70" />
      )}
      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <Input
          placeholder="Título (opcional)"
          value={draft.title ?? ""}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="h-8 text-sm"
        />
        <Textarea
          placeholder="Descripción (opcional)"
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="text-xs min-h-[60px]"
        />
        <Input
          placeholder="Enlace https:// (opcional)"
          value={draft.link_url ?? ""}
          onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
          className="h-8 text-xs"
        />
        <div className="flex items-center justify-between gap-2 pt-1 mt-auto">
          <div className="flex items-center gap-2">
            <Switch
              checked={draft.is_visible}
              onCheckedChange={(v) => setDraft({ ...draft, is_visible: v })}
              id={`wv-${work.id}`}
            />
            <Label htmlFor={`wv-${work.id}`} className="text-[11px] text-muted-foreground">
              Visible
            </Label>
          </div>
          <div className="flex items-center gap-1">
            {work.link_url && (
              <a
                href={work.link_url}
                target="_blank"
                rel="noreferrer"
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2"
              disabled={!dirty}
              onClick={() =>
                onUpdate({
                  title: draft.title,
                  description: draft.description,
                  link_url: draft.link_url,
                  is_visible: draft.is_visible,
                })
              }
            >
              <Save className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-destructive"
              onClick={onDelete}
              aria-label="Eliminar trabajo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
