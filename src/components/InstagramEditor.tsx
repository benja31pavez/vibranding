import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MediaUpload } from "./MediaUpload";
import { uploadClientMedia } from "@/lib/uploadMedia";
import { Image as ImageIcon, Layers, Film, Plus, Trash2, GripVertical, Loader2, Upload, X, Star, MapPin, Music, Heart, MessageCircle, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
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
  current_show_contact_button: boolean;
  current_contact_phone: string | null;
  current_contact_email: string | null;
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
  proposed_show_contact_button: boolean;
  proposed_contact_phone: string | null;
  proposed_contact_email: string | null;
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
  objective: string | null;
  music: string | null;
  location: string | null;
  likes_count: number;
}

export interface IGComment {
  id: string;
  post_id: string;
  client_id: string;
  username: string;
  text: string;
  position: number;
}

export interface IGHighlight {
  id: string;
  client_id: string;
  type: "current" | "proposed";
  position: number;
  title: string | null;
  cover_url: string | null;
  media_urls: string[];
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

function CircleCoverUpload({
  clientId, value, onChange,
}: {
  clientId: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const handle = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadClientMedia(file, clientId);
      onChange(url);
    } catch (e: any) {
      toast.error(e.message ?? "Error al subir");
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="relative w-14 h-14">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-14 h-14 rounded-full bg-muted border overflow-hidden flex items-center justify-center hover:ring-2 hover:ring-foreground/20"
        title="Subir portada"
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : value ? (
          <img src={value} alt="" className="w-full h-full object-cover" />
        ) : (
          <Upload className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {value && !uploading && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute -top-1 -right-1 bg-black/70 text-white rounded-full p-0.5 hover:bg-black"
          aria-label="Quitar"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = "";
        }}
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
      <div className="flex items-center gap-3">
        <CircleCoverUpload
          clientId={clientId}
          value={(profile[avatarKey] as string) ?? null}
          onChange={(url) => {
            set({ [avatarKey]: url } as any);
            save({ [avatarKey]: url } as any);
          }}
        />
        <div className="flex flex-col">
          <Label className={`text-xs ${accent ? "text-accent" : "text-muted-foreground"}`}>Foto de perfil</Label>
          <span className="text-[11px] text-muted-foreground">PNG o JPG</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Usuario" accent={accent} {...text(usernameKey)} />
        <TextField label="Nombre" accent={accent} {...text(displayKey)} />

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
  const contactKey = `${side}_show_contact_button` as keyof IGProfile;
  const phoneKey = `${side}_contact_phone` as keyof IGProfile;
  const emailKey = `${side}_contact_email` as keyof IGProfile;

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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile[categoryKey] !== null}
              onChange={(e) => {
                const v = e.target.checked ? "" : null;
                set({ [categoryKey]: v } as any);
                save({ [categoryKey]: v } as any);
              }}
            />
            Mostrar categoría
          </label>
          {profile[categoryKey] !== null && (
            <>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Categoría</Label>
              <select
                className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={(profile[categoryKey] as string) ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  set({ [categoryKey]: v } as any);
                  save({ [categoryKey]: v } as any);
                }}
              >
                <option value="">— Selecciona —</option>
                {IG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Descripción del perfil</Label>
        <Textarea
          rows={3}
          placeholder="Bio que aparece bajo la categoría"
          value={(profile[`${side}_bio` as keyof IGProfile] as string) ?? ""}
          onChange={(e) => set({ [`${side}_bio`]: e.target.value } as any)}
          onBlur={(e) => save({ [`${side}_bio`]: e.target.value || null } as any)}
          className="text-xs"
        />
      </div>

      {(() => {
        const linkKey = `${side}_link` as keyof IGProfile;
        const raw = (profile[linkKey] as string) ?? "";
        const links = raw ? raw.split("\n") : [""];
        while (links.length < 1) links.push("");
        const commit = (arr: string[]) => {
          const cleaned = arr.map((s) => s.trim()).filter(Boolean);
          const v = cleaned.length ? cleaned.join("\n") : null;
          set({ [linkKey]: v } as any);
          save({ [linkKey]: v } as any);
        };
        const updateAt = (i: number, val: string) => {
          const next = [...links];
          next[i] = val;
          set({ [linkKey]: next.join("\n") } as any);
        };
        return (
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Enlaces ({links.filter(Boolean).length}/5)
            </Label>
            {links.map((l, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input
                  placeholder="https://..."
                  value={l}
                  onChange={(e) => updateAt(i, e.target.value)}
                  onBlur={() => commit(links)}
                  className="h-8 text-xs"
                />
                {links.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => commit(links.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {links.length < 5 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => commit([...links, ""])}
              >
                <Plus className="w-3 h-3 mr-1" /> Agregar enlace
              </Button>
            )}
          </div>
        );
      })()}

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

      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!profile[contactKey]}
            onChange={(e) => {
              set({ [contactKey]: e.target.checked } as any);
              save({ [contactKey]: e.target.checked } as any);
            }}
          />
          Mostrar botón "Contactar"
        </label>
        {profile[contactKey] && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Input
              placeholder="Teléfono"
              value={(profile[phoneKey] as string) ?? ""}
              onChange={(e) => set({ [phoneKey]: e.target.value } as any)}
              onBlur={(e) => save({ [phoneKey]: e.target.value || null } as any)}
              className="h-8 text-xs"
            />
            <Input
              placeholder="Correo"
              type="email"
              value={(profile[emailKey] as string) ?? ""}
              onChange={(e) => set({ [emailKey]: e.target.value } as any)}
              onBlur={(e) => save({ [emailKey]: e.target.value || null } as any)}
              className="h-8 text-xs"
            />
          </div>
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
  clientId, posts, setPosts, type, profile, setProfile, comments, setComments,
}: {
  clientId: string;
  posts: IGPost[];
  setPosts: (updater: (prev: IGPost[]) => IGPost[]) => void;
  type: "current" | "proposed";
  profile?: IGProfile | null;
  setProfile?: (p: IGProfile | null) => void;
  comments: IGComment[];
  setComments: (updater: (prev: IGComment[]) => IGComment[]) => void;
}) {
  const desiredCount = Math.max(
    0,
    Math.min(
      30,
      (type === "proposed"
        ? profile?.proposed_posts_count
        : profile?.current_posts_count) ?? 6,
    ),
  );

  useEffect(() => {
    (async () => {
      const existing = posts.filter((p) => p.type === type);
      const missing: { client_id: string; type: "current" | "proposed"; position: number }[] = [];
      for (let i = 0; i < desiredCount; i++) {
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
  }, [clientId, type, desiredCount]);


  const setLocal = (id: string, patch: Partial<IGPost>) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const saveRemote = async (id: string, patch: Partial<IGPost>) => {
    await supabase.from("instagram_posts").update(patch).eq("id", id);
  };

  const addComment = async (postId: string) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const position = comments.filter((c) => c.post_id === postId).length;
    const { data } = await supabase
      .from("instagram_post_comments")
      .insert({ post_id: postId, client_id: post.client_id, username: "", text: "", position })
      .select("*")
      .single();
    if (data) setComments((prev) => [...prev, data as IGComment]);
  };
  const updateComment = async (id: string, patch: Partial<IGComment>) => {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    await supabase.from("instagram_post_comments").update(patch).eq("id", id);
  };
  const removeComment = async (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("instagram_post_comments").delete().eq("id", id);
  };

  const countKey = (type === "proposed" ? "proposed_posts_count" : "current_posts_count") as keyof IGProfile;

  const addPost = async () => {
    const existing = posts.filter((p) => p.type === type);
    const position = existing.length;
    if (position >= 30) return;
    const { data } = await supabase
      .from("instagram_posts")
      .insert({ client_id: clientId, type, position })
      .select("*")
      .single();
    if (data) setPosts((prev) => [...prev, data as IGPost]);
    if (profile && setProfile) {
      const next = { ...profile, [countKey]: position + 1 } as IGProfile;
      setProfile(next);
      await supabase.from("instagram_profiles").update({ [countKey]: position + 1 } as never).eq("id", profile.id);
    }
  };

  const removePost = async (id: string) => {
    const remaining = posts
      .filter((p) => p.type === type && p.id !== id)
      .sort((a, b) => a.position - b.position);
    setPosts((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("instagram_posts").delete().eq("id", id);
    const updates = remaining.map((p, i) => ({ id: p.id, position: i }));
    setPosts((prev) =>
      prev.map((p) => {
        const u = updates.find((x) => x.id === p.id);
        return u ? { ...p, position: u.position } : p;
      }),
    );
    await Promise.all(
      updates.map((u) =>
        supabase.from("instagram_posts").update({ position: u.position }).eq("id", u.id),
      ),
    );
    if (profile && setProfile) {
      const newCount = remaining.length;
      const next = { ...profile, [countKey]: newCount } as IGProfile;
      setProfile(next);
      await supabase.from("instagram_profiles").update({ [countKey]: newCount } as never).eq("id", profile.id);
    }
  };

  const sorted = [...posts]
    .filter((p) => p.type === type)
    .sort((a, b) => a.position - b.position);

  const [dragId, setDragId] = useState<string | null>(null);

  const reorder = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const arr = [...sorted];
    const fromIdx = arr.findIndex((x) => x.id === fromId);
    const toIdx = arr.findIndex((x) => x.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    const updates = arr.map((p, i) => ({ id: p.id, position: i }));
    setPosts((prev) =>
      prev.map((p) => {
        const u = updates.find((x) => x.id === p.id);
        return u ? { ...p, position: u.position } : p;
      }),
    );
    await Promise.all(
      updates.map((u) =>
        supabase.from("instagram_posts").update({ position: u.position }).eq("id", u.id),
      ),
    );
  };

  const splitDateTime = (iso: string | null) => {
    if (!iso) return { date: "", time: "" };
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  };

  const combineDateTime = (date: string, time: string): string | null => {
    if (!date) return null;
    const t = time || "00:00";
    return new Date(`${date}T${t}`).toISOString();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40">
              <th className="text-left px-2 py-2 w-10">#</th>
              <th className="text-left px-2 py-2 w-20">Imagen</th>
              <th className="text-left px-2 py-2 w-28">Tipo</th>
              <th className="text-left px-2 py-2 w-10" title="Mejores amigos">★</th>
              <th className="text-left px-2 py-2 w-48">Fecha</th>
              <th className="text-left px-2 py-2">Caption</th>
              <th className="text-left px-2 py-2 w-20">Engagement</th>
              <th className="text-left px-2 py-2 w-44">Objetivo</th>
              <th className="text-left px-2 py-2 w-10"></th>

            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => {
              const { date, time } = splitDateTime(p.scheduled_at);
              return (
                <tr
                  key={p.id}
                  draggable
                  onDragStart={() => setDragId(p.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId) reorder(dragId, p.id);
                    setDragId(null);
                  }}
                  onDragEnd={() => setDragId(null)}
                  className={`border-t align-middle transition-opacity ${
                    dragId === p.id ? "opacity-40" : ""
                  }`}
                >
                  <td className="px-2 py-2 text-muted-foreground text-[10px] tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="px-2 py-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-14 h-14 rounded-md overflow-hidden bg-muted border hover:ring-2 hover:ring-foreground/20 flex items-center justify-center"
                        >
                          {p.image_url ? (
                            <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Upload className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 space-y-3" align="start">
                        <div className="space-y-1.5">
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
                        </div>
                        {p.format === "reel" && (
                          <div className="space-y-1.5">
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
                            <label className="flex items-center gap-2 text-xs pt-1">
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
                          </div>
                        )}
                        {p.format !== "reel" && (
                          <CarouselImages
                            clientId={clientId}
                            urls={p.carousel_urls ?? []}
                            onChange={(urls) => {
                              const patch: Partial<IGPost> = { carousel_urls: urls };
                              // Auto-switch to carousel format when adding multiple slides
                              if (urls.length > 1 && p.format !== "carousel") {
                                patch.format = "carousel";
                              }
                              // Use first slide as cover if no main image yet
                              if (!p.image_url && urls[0]) {
                                patch.image_url = urls[0];
                              }
                              setLocal(p.id, patch);
                              saveRemote(p.id, patch);
                            }}
                          />
                        )}
                      </PopoverContent>
                    </Popover>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      {FORMATS.map(({ value, label, Icon }) => (
                        <button
                          key={value}
                          type="button"
                          title={label}
                          onClick={() => {
                            setLocal(p.id, { format: value });
                            saveRemote(p.id, { format: value });
                          }}
                          className={`p-1.5 rounded-md transition-colors ${
                            p.format === value
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      title="Solo mejores amigos"
                      onClick={() => {
                        const v = !p.close_friends_only;
                        setLocal(p.id, { close_friends_only: v });
                        saveRemote(p.id, { close_friends_only: v });
                      }}
                      className={`p-1.5 rounded-md transition-colors ${
                        p.close_friends_only
                          ? "bg-emerald-500 text-white"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Star
                        className="w-3.5 h-3.5"
                        fill={p.close_friends_only ? "currentColor" : "none"}
                      />
                    </button>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "h-8 px-2 text-xs font-normal justify-start gap-1.5 flex-1 min-w-0",
                              !date && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">
                              {date
                                ? new Date(`${date}T00:00`).toLocaleDateString(undefined, {
                                    day: "2-digit",
                                    month: "short",
                                    year: "2-digit",
                                  })
                                : "Fecha"}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={date ? new Date(`${date}T00:00`) : undefined}
                            onSelect={(d) => {
                              if (!d) return;
                              const pad = (n: number) => String(n).padStart(2, "0");
                              const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                              const v = combineDateTime(ds, time || "00:00");
                              setLocal(p.id, { scheduled_at: v });
                              saveRemote(p.id, { scheduled_at: v });
                            }}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <Input
                        type="time"
                        value={time}
                        disabled={!date}
                        onChange={(e) => {
                          const v = combineDateTime(date, e.target.value);
                          setLocal(p.id, { scheduled_at: v });
                        }}
                        onBlur={(e) => {
                          const v = combineDateTime(date, e.target.value);
                          saveRemote(p.id, { scheduled_at: v });
                        }}
                        className="h-8 text-xs w-[88px] px-2"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="w-full text-left text-xs px-2 py-1.5 rounded-md border bg-background hover:bg-muted/50 min-h-[32px] line-clamp-2 whitespace-pre-wrap break-words"
                          title={p.caption ?? "Editar caption"}
                        >
                          {p.caption?.trim() ? p.caption : (
                            <span className="text-muted-foreground">Caption…</span>
                          )}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-96 space-y-3" align="start">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Caption
                          </Label>
                          <Textarea
                            autoFocus
                            placeholder="Escribe el caption…"
                            value={p.caption ?? ""}
                            rows={8}
                            onChange={(e) => setLocal(p.id, { caption: e.target.value })}
                            onBlur={(e) => saveRemote(p.id, { caption: e.target.value || null })}
                            className="text-sm mt-1"
                          />
                          <div className="text-[10px] text-muted-foreground text-right">
                            {(p.caption ?? "").length} caracteres
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> Ubicación
                            </Label>
                            <Input
                              placeholder="Ej: Madrid, España"
                              value={p.location ?? ""}
                              onChange={(e) => setLocal(p.id, { location: e.target.value })}
                              onBlur={(e) => saveRemote(p.id, { location: e.target.value || null })}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <Music className="w-3 h-3" /> Música
                            </Label>
                            <Input
                              placeholder="Artista — Canción"
                              value={p.music ?? ""}
                              onChange={(e) => setLocal(p.id, { music: e.target.value })}
                              onBlur={(e) => saveRemote(p.id, { music: e.target.value || null })}
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </td>
                  <td className="px-2 py-2">
                    {(() => {
                      const postComments = comments
                        .filter((c) => c.post_id === p.id)
                        .sort((a, b) => a.position - b.position);
                      const hasAny = !!(p.music || p.location || p.likes_count || postComments.length);
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={`w-full flex items-center justify-center gap-1 text-[10px] px-2 py-1.5 rounded-md border bg-background hover:bg-muted/50 min-h-[32px] ${hasAny ? "text-foreground" : "text-muted-foreground"}`}
                              title="Música, ubicación, likes, comentarios"
                            >
                              <Heart className="w-3 h-3" />
                              <span className="tabular-nums">{p.likes_count ?? 0}</span>
                              <MessageCircle className="w-3 h-3 ml-1" />
                              <span className="tabular-nums">{postComments.length}</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-96 space-y-3" align="start">
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Heart className="w-3 h-3" /> Likes
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                value={p.likes_count ?? 0}
                                onChange={(e) => setLocal(p.id, { likes_count: Number(e.target.value) })}
                                onBlur={(e) => saveRemote(p.id, { likes_count: Number(e.target.value) })}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                  <MessageCircle className="w-3 h-3" /> Comentarios
                                </Label>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] px-2"
                                  onClick={() => addComment(p.id)}
                                >
                                  <Plus className="w-3 h-3 mr-0.5" /> Añadir
                                </Button>
                              </div>
                              {postComments.length === 0 && (
                                <p className="text-[10px] text-muted-foreground italic">Sin comentarios.</p>
                              )}
                              {postComments.map((c) => (
                                <div key={c.id} className="flex items-start gap-1">
                                  <Input
                                    placeholder="usuario"
                                    value={c.username}
                                    onChange={(e) => setComments((prev) => prev.map((x) => x.id === c.id ? { ...x, username: e.target.value } : x))}
                                    onBlur={(e) => updateComment(c.id, { username: e.target.value })}
                                    className="h-7 text-xs w-24"
                                  />
                                  <Input
                                    placeholder="Comentario…"
                                    value={c.text}
                                    onChange={(e) => setComments((prev) => prev.map((x) => x.id === c.id ? { ...x, text: e.target.value } : x))}
                                    onBlur={(e) => updateComment(c.id, { text: e.target.value })}
                                    className="h-7 text-xs flex-1"
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 shrink-0"
                                    onClick={() => removeComment(c.id)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })()}
                  </td>
                  <td className="px-2 py-2">
                    {(() => {
                      const OBJECTIVE_GROUPS: { category: string; items: string[] }[] = [
                        {
                          category: "Venta",
                          items: [
                            "Vender",
                            "Promocionar oferta",
                            "Para hacer anuncios",
                            "Lanzar producto",
                            "Mostrar producto",
                            "FOMO o escasez",
                            "Desmitificar precios",
                          ],
                        },
                        {
                          category: "Leads y tráfico",
                          items: [
                            "Generar leads",
                            "Dirigir tráfico web",
                            "Que me escriban por DM",
                            "Sorteo o giveaway",
                          ],
                        },
                        {
                          category: "Comunidad e interacción",
                          items: [
                            "Generar interacción",
                            "Construir comunidad",
                            "Abrir debate",
                            "Encuesta o dinámica",
                            "Reacción a comentario",
                            "Reto o desafío",
                            "Que lo compartan",
                            "Que lo guarden",
                          ],
                        },
                        {
                          category: "Alcance y viralidad",
                          items: [
                            "Aumentar alcance",
                            "Hacer un reel viral",
                            "Reaccionar a tendencia",
                            "Publicación colaborativa",
                            "Nostalgia",
                          ],
                        },
                        {
                          category: "Educación y valor",
                          items: [
                            "Educar",
                            "Tutorial o how-to",
                            "Carrusel educativo",
                            "Consejo rápido",
                            "Explicar el proceso",
                            "Preguntas frecuentes",
                            "Mitos vs realidades",
                            "Errores comunes",
                            "Hacer una lista",
                            "Revelar datos curiosos",
                            "Revelar un secreto",
                            "Recomendación de libro o podcast",
                            "Noticia de la industria",
                          ],
                        },
                        {
                          category: "Marca y posicionamiento",
                          items: [
                            "Posicionar marca",
                            "Contar historia de marca",
                            "Cita de autoridad",
                            "Activismo o causas",
                            "Inspirar",
                            "Frase o reflexión",
                          ],
                        },
                        {
                          category: "Detrás de cámaras",
                          items: [
                            "Behind the scenes",
                            "Presentar equipo",
                            "Proceso de creación",
                            "Día de la vida",
                            "Spoiler de novedad",
                            "Bloopers",

                          ],
                        },
                        {
                          category: "Prueba social",
                          items: [
                            "Destacar testimonios",
                            "Repost de cliente",
                            "Caso de éxito",
                            "Agradecimiento a clientes",
                            "Celebrar un logro",
                            "Recopilar opiniones",
                            "Antes y después",
                            "Expectativa vs realidad",
                            "Comparativa o vs",
                            "Hacer unboxing",
                            "Historias de fracaso",
                          ],
                        },
                        {
                          category: "Entretenimiento",
                          items: [
                            "Entretener",
                            "Anunciar evento",
                            "Mini serie",
                            "Skit o sketch",
                            "Parodia",
                            "Humor o meme",
                            "Trend de audio",
                            "Baile o coreografía",
                            "Lip sync",
                            "Storytime",
                            "POV (punto de vista)",
                            "ASMR",
                            "Reacción en vivo",
                            "Juego o trivia",
                            "Esto o aquello",
                            "Tier list o ranking",
                            "Cuenta regresiva",
                            "Celebrar fecha especial",
                            "Tag o cadena",
                            "Cover musical",
                            "Mini documental",
                          ],
                        },
                      ];

                      const selected = (p.objective ?? "")
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const toggle = (opt: string) => {
                        const next = selected.includes(opt)
                          ? selected.filter((s) => s !== opt)
                          : [...selected, opt];
                        const value = next.join(", ");
                        setLocal(p.id, { objective: value });
                        saveRemote(p.id, { objective: value || null });
                      };
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="w-full text-left text-xs px-2 py-1.5 rounded-md border bg-background hover:bg-muted/50 min-h-[32px] line-clamp-2 whitespace-pre-wrap break-words"
                              title={selected.join(", ") || "Definir objetivo"}
                            >
                              {selected.length > 0 ? selected.join(", ") : (
                                <span className="text-muted-foreground">Objetivo…</span>
                              )}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 max-h-80 overflow-y-auto" align="start">
                            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                              Objetivos de la publicación
                            </Label>
                            <div className="mt-2 space-y-3">
                              {OBJECTIVE_GROUPS.map((group) => (
                                <div key={group.category}>
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 px-1.5 mb-1 border-b pb-1">
                                    {group.category}
                                  </div>
                                  <div className="space-y-1">
                                    {group.items.map((opt) => {
                                      const checked = selected.includes(opt);
                                      return (
                                        <label
                                          key={opt}
                                          className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggle(opt)}
                                            className="accent-primary"
                                          />
                                          <span>{opt}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>

                          </PopoverContent>
                        </Popover>
                      );
                    })()}
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-8 w-8"
                      onClick={() => removePost(p.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground cursor-move">
                    <GripVertical className="w-4 h-4" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addPost} disabled={sorted.length >= 30}>
        <Plus className="w-4 h-4 mr-1" /> Añadir publicación
      </Button>
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
      <div className="rounded-xl border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40">
                <th className="text-left px-2 py-2 w-10">#</th>
                <th className="text-left px-2 py-2 w-20">Portada</th>
                <th className="text-left px-2 py-2">Título</th>
                <th className="text-left px-2 py-2 w-64">Contenido</th>
                <th className="text-left px-2 py-2 w-10"></th>
                <th className="text-left px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((h, idx) => (
                <tr
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
                  className={`border-t align-middle transition-opacity ${
                    dragId === h.id ? "opacity-40" : ""
                  }`}
                >
                  <td className="px-2 py-2 text-muted-foreground text-[10px] tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="px-2 py-2">
                    <CircleCoverUpload
                      clientId={clientId}
                      value={h.cover_url}
                      onChange={(url) => update(h.id, { cover_url: url })}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      placeholder="Título"
                      value={h.title ?? ""}
                      onChange={(e) => setHighlights((prev) =>
                        prev.map((x) => (x.id === h.id ? { ...x, title: e.target.value } : x))
                      )}
                      onBlur={(e) => update(h.id, { title: e.target.value || null })}
                      className="text-xs h-8"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border bg-background hover:bg-muted/50"
                        >
                          <Upload className="w-3 h-3" />
                          {(h.media_urls ?? []).length} archivo{(h.media_urls ?? []).length === 1 ? "" : "s"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 space-y-2" align="start">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Contenido de la historia
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          {(h.media_urls ?? []).map((url, i) => (
                            <div key={i} className="relative group aspect-[9/16] rounded overflow-hidden bg-muted">
                              <img src={url} alt="" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => {
                                  const next = (h.media_urls ?? []).filter((_, idx2) => idx2 !== i);
                                  update(h.id, { media_urls: next });
                                }}
                                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <MediaUpload
                          clientId={clientId}
                          shape="square"
                          value={null}
                          onChange={(url) => {
                            if (!url) return;
                            const next = [...(h.media_urls ?? []), url];
                            update(h.id, { media_urls: next });
                          }}
                          showUrl={false}
                        />
                      </PopoverContent>
                    </Popover>
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive h-8 w-8"
                      onClick={() => remove(h.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground cursor-move">
                    <GripVertical className="w-4 h-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="w-4 h-4 mr-1" /> Añadir destacada
      </Button>
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
  const [progress, setProgress] = useState<string | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: File[]) => {
    const uploaded: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setProgress(`Subiendo ${i + 1}/${files.length}`);
      uploaded.push(await uploadClientMedia(files[i], clientId));
    }
    return uploaded;
  };

  const handleImages = async (files: File[]) => {
    setUploading(true);
    try {
      const uploaded = await uploadFiles(files);
      onChange([...urls, ...uploaded]);
    } catch (e: any) {
      toast.error(e.message ?? "Error al subir");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const handlePdfs = async (files: File[]) => {
    setUploading(true);
    try {
      const { pdfToImageFiles } = await import("@/lib/pdfToImages");
      const allImages: File[] = [];
      for (const f of files) {
        setProgress(`Convirtiendo ${f.name}…`);
        const pages = await pdfToImageFiles(f);
        allImages.push(...pages);
      }
      if (allImages.length === 0) {
        toast.error("No se pudo convertir ninguna página del PDF");
        return;
      }
      const uploaded = await uploadFiles(allImages);
      onChange([...urls, ...uploaded]);
      toast.success(`${uploaded.length} diapositivas añadidas`);
    } catch (e: any) {
      toast.error(e.message ?? "Error al procesar el PDF");
    } finally {
      setUploading(false);
      setProgress(null);
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
      </div>
      <div className="flex gap-1.5 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => imgInputRef.current?.click()}
          className="flex-1 h-8 text-xs"
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
          Subir imagen
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => pdfInputRef.current?.click()}
          className="flex-1 h-8 text-xs"
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
          Subir PDF
        </Button>
      </div>
      {progress && (
        <p className="text-[10px] text-muted-foreground">{progress}</p>
      )}
      <input
        ref={imgInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) handleImages(files);
          e.target.value = "";
        }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) handlePdfs(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
