import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MediaUpload } from "./MediaUpload";
import { uploadClientMedia } from "@/lib/uploadMedia";
import { Image as ImageIcon, Layers, Film, Plus, Trash2, GripVertical, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type PostFormat = "photo" | "carousel" | "reel";

export type AccountType = "personal" | "business";

export const IG_CATEGORIES = [
  "Artista", "Músico/Grupo de música", "Bloguero", "Ropa (marca)", "Comunidad",
  "Creador digital", "Educación", "Emprendedor", "Salud/Belleza", "Editor",
  "Escritor", "Blog personal", "Producto/Servicio", "Jugador", "Restaurante",
  "Belleza, cosmética y cuidado personal", "Tienda de alimentos", "Fotógrafo",
  "Compras y ventas al por menor", "Creador de reels",
] as const;

export interface IGProfile {
  id: string;
  client_id: string;
  current_username: string | null;
  current_display_name: string | null;
  current_followers: number | null;
  current_following: number | null;
  current_posts_count: number | null;
  current_avatar_url: string | null;
  current_bio: string | null;
  current_link: string | null;
  current_account_type: AccountType;
  current_category: string | null;
  current_verified: boolean;
  current_threads_enabled: boolean;
  current_threads_handle: string | null;
  current_song_enabled: boolean;
  current_song: string | null;
  proposed_username: string | null;
  proposed_display_name: string | null;
  proposed_followers: number | null;
  proposed_following: number | null;
  proposed_posts_count: number | null;
  proposed_avatar_url: string | null;
  proposed_bio: string | null;
  proposed_link: string | null;
  proposed_account_type: AccountType;
  proposed_category: string | null;
  proposed_verified: boolean;
  proposed_threads_enabled: boolean;
  proposed_threads_handle: string | null;
  proposed_song_enabled: boolean;
  proposed_song: string | null;
}

export interface IGPost {
  id: string;
  client_id: string;
  type: "current" | "proposed";
  position: number;
  image_url: string | null;
  caption: string | null;
  scheduled_at: string | null;
  format: PostFormat;
  carousel_urls: string[];
  cover_url: string | null;
  is_trial_reel: boolean;
  close_friends_only: boolean;
}

export interface IGHighlight {
  id: string;
  client_id: string;
  type: "current" | "proposed";
  position: number;
  title: string | null;
  cover_url: string | null;
}

type Side = "current" | "proposed";

function TextField({
  label, value, onChange, onBlur, multiline, accent,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
  multiline?: boolean;
  accent?: boolean;
}) {
  const Comp: any = multiline ? Textarea : Input;
  return (
    <div className="space-y-1.5">
      <Label className={`text-xs ${accent ? "text-accent" : "text-muted-foreground"}`}>{label}</Label>
      <Comp
        value={value}
        rows={multiline ? 3 : undefined}
        onChange={(e: any) => onChange(e.target.value)}
        onBlur={(e: any) => onBlur(e.target.value)}
      />
    </div>
  );
}

function NumField({
  label, value, onChange, onBlur, accent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onBlur: (v: number) => void;
  accent?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className={`text-xs ${accent ? "text-accent" : "text-muted-foreground"}`}>{label}</Label>
      <Input
        type="number"
        value={value}
        className={accent ? "border-accent/40 focus-visible:ring-accent" : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={(e) => onBlur(Number(e.target.value))}
      />
    </div>
  );
}

function useProfileHelpers(profile: IGProfile, setProfile: (p: IGProfile) => void) {
  const set = (patch: Partial<IGProfile>) => setProfile({ ...profile, ...patch });
  const save = async (patch: Partial<IGProfile>) => {
    await supabase.from("instagram_profiles").update(patch).eq("id", profile.id);
  };
  return { set, save };
}

export function IdentityEditor({
  profile, setProfile, clientId, side,
}: {
  profile: IGProfile;
  setProfile: (p: IGProfile) => void;
  clientId: string;
  side: Side;
}) {
  const accent = side === "proposed";
  const { set, save } = useProfileHelpers(profile, setProfile);
  const usernameKey = `${side}_username` as keyof IGProfile;
  const displayKey = `${side}_display_name` as keyof IGProfile;
  const avatarKey = `${side}_avatar_url` as keyof IGProfile;
  const linkKey = `${side}_link` as keyof IGProfile;
  const bioKey = `${side}_bio` as keyof IGProfile;
  const postsKey = `${side}_posts_count` as keyof IGProfile;
  const followersKey = `${side}_followers` as keyof IGProfile;
  const followingKey = `${side}_following` as keyof IGProfile;

  const text = (key: keyof IGProfile) => ({
    value: (profile[key] as string) ?? "",
    onChange: (v: string) => set({ [key]: v } as any),
    onBlur: (v: string) => save({ [key]: v || null } as any),
  });
  const num = (key: keyof IGProfile) => ({
    value: (profile[key] as number) ?? 0,
    onChange: (v: number) => set({ [key]: v } as any),
    onBlur: (v: number) => save({ [key]: v } as any),
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Usuario" accent={accent} {...text(usernameKey)} />
        <TextField label="Nombre real" accent={accent} {...text(displayKey)} />
      </div>

      <div className="space-y-1.5">
        <Label className={`text-xs ${accent ? "text-accent" : "text-muted-foreground"}`}>Foto de perfil</Label>
        <MediaUpload
          clientId={clientId}
          shape="circle"
          value={profile[avatarKey] as string | null}
          onChange={(url) => { set({ [avatarKey]: url } as any); save({ [avatarKey]: url } as any); }}
        />
      </div>

      <TextField label="Enlace" accent={accent} {...text(linkKey)} />
      <TextField label="Descripción" accent={accent} multiline {...text(bioKey)} />

      <div className="grid grid-cols-3 gap-3">
        <NumField label="Posts" accent={accent} {...num(postsKey)} />
        <NumField label="Seguidores" accent={accent} {...num(followersKey)} />
        <NumField label="Seguidos" accent={accent} {...num(followingKey)} />
      </div>
    </div>
  );
}

export function ConfigEditor({
  profile, setProfile, side,
}: {
  profile: IGProfile;
  setProfile: (p: IGProfile) => void;
  side: Side;
}) {
  const { set, save } = useProfileHelpers(profile, setProfile);
  const accountTypeKey = `${side}_account_type` as keyof IGProfile;
  const categoryKey = `${side}_category` as keyof IGProfile;
  const verifiedKey = `${side}_verified` as keyof IGProfile;
  const threadsEnKey = `${side}_threads_enabled` as keyof IGProfile;
  const threadsHandleKey = `${side}_threads_handle` as keyof IGProfile;
  const songEnKey = `${side}_song_enabled` as keyof IGProfile;
  const songKey = `${side}_song` as keyof IGProfile;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo de cuenta</Label>
        <select
          className="w-full h-9 rounded-md border bg-background px-2 text-sm"
          value={profile[accountTypeKey] as AccountType}
          onChange={(e) => {
            const v = e.target.value as AccountType;
            set({ [accountTypeKey]: v } as any);
            save({ [accountTypeKey]: v } as any);
          }}
        >
          <option value="personal">Personal</option>
          <option value="business">Empresa</option>
        </select>
      </div>

      {profile[accountTypeKey] === "business" && (
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Categoría</Label>
          <select
            className="w-full h-9 rounded-md border bg-background px-2 text-sm"
            value={(profile[categoryKey] as string) ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              set({ [categoryKey]: v } as any);
              save({ [categoryKey]: v } as any);
            }}
          >
            <option value="">— Sin categoría —</option>
            {IG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!profile[verifiedKey]}
          onChange={(e) => {
            set({ [verifiedKey]: e.target.checked } as any);
            save({ [verifiedKey]: e.target.checked } as any);
          }}
        />
        Verificado azul
      </label>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!profile[threadsEnKey]}
            onChange={(e) => {
              set({ [threadsEnKey]: e.target.checked } as any);
              save({ [threadsEnKey]: e.target.checked } as any);
            }}
          />
          Mostrar Threads
        </label>
        {profile[threadsEnKey] && (
          <Input
            placeholder="@usuario de Threads"
            value={(profile[threadsHandleKey] as string) ?? ""}
            onChange={(e) => set({ [threadsHandleKey]: e.target.value } as any)}
            onBlur={(e) => save({ [threadsHandleKey]: e.target.value || null } as any)}
            className="h-8 text-xs"
          />
        )}
      </div>

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!profile[songEnKey]}
            onChange={(e) => {
              set({ [songEnKey]: e.target.checked } as any);
              save({ [songEnKey]: e.target.checked } as any);
            }}
          />
          Mostrar canción
        </label>
        {profile[songEnKey] && (
          <Input
            placeholder="Artista — Canción"
            value={(profile[songKey] as string) ?? ""}
            onChange={(e) => set({ [songKey]: e.target.value } as any)}
            onBlur={(e) => save({ [songKey]: e.target.value || null } as any)}
            className="h-8 text-xs"
          />
        )}
      </div>
    </div>
  );
}

// Backwards-compat wrapper
export function ProfileEditor(props: {
  profile: IGProfile;
  setProfile: (p: IGProfile) => void;
  clientId: string;
  side: Side;
}) {
  return (
    <div className="space-y-6">
      <IdentityEditor {...props} />
      <div className="rounded-xl border p-3 bg-surface">
        <ConfigEditor profile={props.profile} setProfile={props.setProfile} side={props.side} />
      </div>
    </div>
  );
}

const FORMATS: { value: PostFormat; label: string; Icon: typeof ImageIcon }[] = [
  { value: "photo", label: "Foto", Icon: ImageIcon },
  { value: "carousel", label: "Carrusel", Icon: Layers },
  { value: "reel", label: "Reel", Icon: Film },
];

export function PostsEditor({
  clientId, posts, setPosts, type,
}: {
  clientId: string;
  posts: IGPost[];
  setPosts: (updater: (prev: IGPost[]) => IGPost[]) => void;
  type: "current" | "proposed";
}) {
  useEffect(() => {
    (async () => {
      const existing = posts.filter((p) => p.type === type);
      const missing: { client_id: string; type: "current" | "proposed"; position: number }[] = [];
      for (let i = 0; i < 6; i++) {
        if (!existing.find((p) => p.position === i)) {
          missing.push({ client_id: clientId, type, position: i });
        }
      }
      if (missing.length) {
        const { data } = await supabase.from("instagram_posts").insert(missing).select("*");
        if (data) setPosts((prev) => [...prev, ...(data as IGPost[])]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, type]);

  const slots = Array.from({ length: 6 }, (_, i) =>
    posts.find((p) => p.type === type && p.position === i),
  );

  const setLocal = (id: string, patch: Partial<IGPost>) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const saveRemote = async (id: string, patch: Partial<IGPost>) => {
    await supabase.from("instagram_posts").update(patch).eq("id", id);
  };

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {slots.map((p, i) => (
        <div key={p?.id ?? i} className="rounded-2xl border bg-surface p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Post #{i + 1}</div>
            <div className="flex gap-1">
              {FORMATS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  onClick={() => {
                    if (!p) return;
                    setLocal(p.id, { format: value });
                    saveRemote(p.id, { format: value });
                  }}
                  className={`p-1 rounded-md transition-colors ${
                    p?.format === value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>
          {p && (
            <>
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {p.format === "reel" ? "Imagen del reel" : "Imagen principal"}
              </Label>
              <MediaUpload
                clientId={clientId}
                value={p.image_url}
                onChange={(url) => {
                  setLocal(p.id, { image_url: url });
                  saveRemote(p.id, { image_url: url });
                }}
                showUrl={false}
              />
              {p.format === "reel" && (
                <>
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Carátula (thumbnail del grid)
                  </Label>
                  <MediaUpload
                    clientId={clientId}
                    value={p.cover_url}
                    onChange={(url) => {
                      setLocal(p.id, { cover_url: url });
                      saveRemote(p.id, { cover_url: url });
                    }}
                    showUrl={false}
                  />
                </>
              )}
              {p.format === "carousel" && (
                <CarouselImages
                  clientId={clientId}
                  urls={p.carousel_urls ?? []}
                  onChange={(urls) => {
                    setLocal(p.id, { carousel_urls: urls });
                    saveRemote(p.id, { carousel_urls: urls });
                  }}
                />
              )}
              <Textarea
                placeholder="Caption…"
                value={p.caption ?? ""}
                rows={2}
                onChange={(e) => setLocal(p.id, { caption: e.target.value })}
                onBlur={(e) => saveRemote(p.id, { caption: e.target.value || null })}
              />
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Fecha y hora
                </Label>
                <Input
                  type="datetime-local"
                  value={p.scheduled_at ? toLocalInput(p.scheduled_at) : ""}
                  onChange={(e) => {
                    const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                    setLocal(p.id, { scheduled_at: v });
                  }}
                  onBlur={(e) => {
                    const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                    saveRemote(p.id, { scheduled_at: v });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1 pt-1 border-t">
                {p.format === "reel" && (
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={p.is_trial_reel}
                      onChange={(e) => {
                        setLocal(p.id, { is_trial_reel: e.target.checked });
                        saveRemote(p.id, { is_trial_reel: e.target.checked });
                      }}
                    />
                    Reel de prueba
                  </label>
                )}
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={p.close_friends_only}
                    onChange={(e) => {
                      setLocal(p.id, { close_friends_only: e.target.checked });
                      saveRemote(p.id, { close_friends_only: e.target.checked });
                    }}
                  />
                  Solo mejores amigos
                </label>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function HighlightsEditor({
  clientId, highlights, setHighlights, type,
}: {
  clientId: string;
  highlights: IGHighlight[];
  setHighlights: (updater: (prev: IGHighlight[]) => IGHighlight[]) => void;
  type: "current" | "proposed";
}) {
  const items = highlights
    .filter((h) => h.type === type)
    .sort((a, b) => a.position - b.position);

  const add = async () => {
    const position = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0;
    const { data } = await supabase
      .from("instagram_highlights")
      .insert({ client_id: clientId, type, position, title: "Nueva" })
      .select("*")
      .single();
    if (data) setHighlights((prev) => [...prev, data as IGHighlight]);
  };

  const update = async (id: string, patch: Partial<IGHighlight>) => {
    setHighlights((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    await supabase.from("instagram_highlights").update(patch).eq("id", id);
  };

  const remove = async (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    await supabase.from("instagram_highlights").delete().eq("id", id);
  };

  const [dragId, setDragId] = useState<string | null>(null);

  const reorder = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const arr = [...items];
    const fromIdx = arr.findIndex((x) => x.id === fromId);
    const toIdx = arr.findIndex((x) => x.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    const updates = arr.map((h, i) => ({ id: h.id, position: i }));
    setHighlights((prev) =>
      prev.map((h) => {
        const u = updates.find((x) => x.id === h.id);
        return u ? { ...h, position: u.position } : h;
      }),
    );
    await Promise.all(
      updates.map((u) =>
        supabase.from("instagram_highlights").update({ position: u.position }).eq("id", u.id),
      ),
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {items.map((h) => (
          <div
            key={h.id}
            draggable
            onDragStart={() => setDragId(h.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) reorder(dragId, h.id);
              setDragId(null);
            }}
            onDragEnd={() => setDragId(null)}
            className={`rounded-2xl border bg-surface p-3 w-44 space-y-2 cursor-move transition-opacity ${
              dragId === h.id ? "opacity-40" : ""
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <GripVertical className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-wider">#{h.position + 1}</span>
            </div>
            <MediaUpload
              clientId={clientId}
              shape="circle"
              value={h.cover_url}
              onChange={(url) => update(h.id, { cover_url: url })}
              showUrl={false}
            />
            <Input
              placeholder="Título"
              value={h.title ?? ""}
              onChange={(e) => setHighlights((prev) =>
                prev.map((x) => (x.id === h.id ? { ...x, title: e.target.value } : x))
              )}
              onBlur={(e) => update(h.id, { title: e.target.value || null })}
              className="text-xs h-8"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-destructive"
              onClick={() => remove(h.id)}
            >
              <Trash2 className="w-3 h-3 mr-1" /> Quitar
            </Button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="w-44 h-[180px] rounded-2xl border border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors"
        >
          <Plus className="w-5 h-5 mb-1" />
          <span className="text-xs">Añadir destacada</span>
        </button>
      </div>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CarouselImages({
  clientId, urls, onChange,
}: {
  clientId: string;
  urls: string[];
  onChange: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList) => {
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const f of Array.from(files)) {
        uploaded.push(await uploadClientMedia(f, clientId));
      }
      onChange([...urls, ...uploaded]);
    } catch (e: any) {
      toast.error(e.message ?? "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (i: number) => onChange(urls.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
        Imágenes del carrusel ({urls.length})
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {urls.map((u, i) => (
          <div key={i} className="relative w-12 h-12 rounded-md overflow-hidden bg-muted">
            <img src={u} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute top-0 right-0 bg-black/60 text-white rounded-bl-md p-0.5"
              aria-label="Quitar"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-12 h-12 rounded-md border border-dashed flex items-center justify-center text-muted-foreground hover:bg-muted/50"
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
