import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MediaUpload } from "./MediaUpload";
import { Image as ImageIcon, Layers, Film, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type PostFormat = "photo" | "carousel" | "reel";

export interface IGProfile {
  id: string;
  client_id: string;
  current_username: string | null;
  current_followers: number | null;
  current_following: number | null;
  current_posts_count: number | null;
  current_avatar_url: string | null;
  current_bio: string | null;
  current_link: string | null;
  proposed_username: string | null;
  proposed_followers: number | null;
  proposed_following: number | null;
  proposed_posts_count: number | null;
  proposed_avatar_url: string | null;
  proposed_bio: string | null;
  proposed_link: string | null;
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
}

export interface IGHighlight {
  id: string;
  client_id: string;
  type: "current" | "proposed";
  position: number;
  title: string | null;
  cover_url: string | null;
}

export function ProfileEditor({
  profile,
  setProfile,
  clientId,
}: {
  profile: IGProfile;
  setProfile: (p: IGProfile) => void;
  clientId: string;
}) {
  const set = (patch: Partial<IGProfile>) => setProfile({ ...profile, ...patch });
  const save = async (patch: Partial<IGProfile>) => {
    await supabase.from("instagram_profiles").update(patch).eq("id", profile.id);
  };

  const TextPair = ({
    label, currentKey, proposedKey, multiline = false,
  }: {
    label: string;
    currentKey: keyof IGProfile;
    proposedKey: keyof IGProfile;
    multiline?: boolean;
  }) => {
    const Comp: any = multiline ? Textarea : Input;
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Actual · {label}</Label>
          <Comp
            value={(profile[currentKey] as string) ?? ""}
            rows={multiline ? 3 : undefined}
            onChange={(e: any) => set({ [currentKey]: e.target.value } as any)}
            onBlur={(e: any) => save({ [currentKey]: e.target.value || null } as any)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-accent">Propuesta · {label}</Label>
          <Comp
            value={(profile[proposedKey] as string) ?? ""}
            rows={multiline ? 3 : undefined}
            onChange={(e: any) => set({ [proposedKey]: e.target.value } as any)}
            onBlur={(e: any) => save({ [proposedKey]: e.target.value || null } as any)}
          />
        </div>
      </div>
    );
  };

  const NumPair = ({
    label, currentKey, proposedKey,
  }: {
    label: string;
    currentKey: keyof IGProfile;
    proposedKey: keyof IGProfile;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          placeholder="Actual"
          value={(profile[currentKey] as number) ?? 0}
          onChange={(e) => set({ [currentKey]: Number(e.target.value) } as any)}
          onBlur={(e) => save({ [currentKey]: Number(e.target.value) } as any)}
        />
        <Input
          type="number"
          placeholder="Propuesta"
          className="border-accent/40 focus-visible:ring-accent"
          value={(profile[proposedKey] as number) ?? 0}
          onChange={(e) => set({ [proposedKey]: Number(e.target.value) } as any)}
          onBlur={(e) => save({ [proposedKey]: Number(e.target.value) } as any)}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <TextPair label="Usuario" currentKey="current_username" proposedKey="proposed_username" />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Actual · Foto perfil</Label>
          <MediaUpload
            clientId={clientId}
            shape="circle"
            value={profile.current_avatar_url}
            onChange={(url) => { set({ current_avatar_url: url }); save({ current_avatar_url: url }); }}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-accent">Propuesta · Foto perfil</Label>
          <MediaUpload
            clientId={clientId}
            shape="circle"
            value={profile.proposed_avatar_url}
            onChange={(url) => { set({ proposed_avatar_url: url }); save({ proposed_avatar_url: url }); }}
          />
        </div>
      </div>

      <TextPair label="Enlace" currentKey="current_link" proposedKey="proposed_link" />
      <TextPair label="Descripción" currentKey="current_bio" proposedKey="proposed_bio" multiline />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <NumPair label="Posts" currentKey="current_posts_count" proposedKey="proposed_posts_count" />
        <NumPair label="Seguidores" currentKey="current_followers" proposedKey="proposed_followers" />
        <NumPair label="Seguidos" currentKey="current_following" proposedKey="proposed_following" />
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
              <MediaUpload
                clientId={clientId}
                value={p.image_url}
                onChange={(url) => {
                  setLocal(p.id, { image_url: url });
                  saveRemote(p.id, { image_url: url });
                }}
                showUrl={false}
              />
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {items.map((h) => (
          <div key={h.id} className="rounded-2xl border bg-surface p-3 w-44 space-y-2">
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
