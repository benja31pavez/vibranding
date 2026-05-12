import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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
}

export function ProfileEditor({
  profile,
  setProfile,
}: {
  profile: IGProfile;
  setProfile: (p: IGProfile) => void;
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
      <TextPair label="Foto perfil (URL)" currentKey="current_avatar_url" proposedKey="proposed_avatar_url" />
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
          <div className="text-xs text-muted-foreground">Post #{i + 1}</div>
          {p && (
            <>
              <Input
                placeholder="URL de imagen"
                value={p.image_url ?? ""}
                onChange={(e) => setLocal(p.id, { image_url: e.target.value })}
                onBlur={(e) => saveRemote(p.id, { image_url: e.target.value || null })}
              />
              {p.image_url && (
                <div className="aspect-square rounded-lg bg-muted overflow-hidden">
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                </div>
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
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
