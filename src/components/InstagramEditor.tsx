import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  onUpdate,
}: {
  profile: IGProfile;
  onUpdate: () => void;
}) {
  const [local, setLocal] = useState(profile);
  useEffect(() => setLocal(profile), [profile.id]);

  const save = async (patch: Partial<IGProfile>) => {
    const { error } = await supabase.from("instagram_profiles").update(patch).eq("id", profile.id);
    if (error) return;
    onUpdate();
  };

  const Field = ({
    label, current, proposed, currentKey, proposedKey, type = "text",
  }: any) => (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Actual · {label}</Label>
        <Input
          type={type}
          value={current ?? ""}
          onChange={(e) => setLocal({ ...local, [currentKey]: type === "number" ? Number(e.target.value) : e.target.value })}
          onBlur={(e) => save({ [currentKey]: type === "number" ? Number(e.target.value) : (e.target.value || null) } as any)}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-accent">Propuesta · {label}</Label>
        <Input
          type={type}
          value={proposed ?? ""}
          onChange={(e) => setLocal({ ...local, [proposedKey]: e.target.value })}
          onBlur={(e) => save({ [proposedKey]: e.target.value || null } as any)}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <Field label="Usuario" current={local.current_username} proposed={local.proposed_username} currentKey="current_username" proposedKey="proposed_username" />
      <Field label="Foto perfil (URL)" current={local.current_avatar_url} proposed={local.proposed_avatar_url} currentKey="current_avatar_url" proposedKey="proposed_avatar_url" />
      <Field label="Enlace" current={local.current_link} proposed={local.proposed_link} currentKey="current_link" proposedKey="proposed_link" />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Actual · Descripción</Label>
          <Textarea
            value={local.current_bio ?? ""}
            onChange={(e) => setLocal({ ...local, current_bio: e.target.value })}
            onBlur={(e) => save({ current_bio: e.target.value || null })}
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-accent">Propuesta · Descripción</Label>
          <Textarea
            value={local.proposed_bio ?? ""}
            onChange={(e) => setLocal({ ...local, proposed_bio: e.target.value })}
            onBlur={(e) => save({ proposed_bio: e.target.value || null })}
            rows={3}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Posts</Label>
          <Input type="number" value={local.current_posts_count ?? 0}
            onChange={(e) => setLocal({ ...local, current_posts_count: Number(e.target.value) })}
            onBlur={(e) => save({ current_posts_count: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Seguidores</Label>
          <Input type="number" value={local.current_followers ?? 0}
            onChange={(e) => setLocal({ ...local, current_followers: Number(e.target.value) })}
            onBlur={(e) => save({ current_followers: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Seguidos</Label>
          <Input type="number" value={local.current_following ?? 0}
            onChange={(e) => setLocal({ ...local, current_following: Number(e.target.value) })}
            onBlur={(e) => save({ current_following: Number(e.target.value) })} />
        </div>
      </div>
    </div>
  );
}

export function PostsEditor({
  clientId, posts, onUpdate, type,
}: {
  clientId: string;
  posts: IGPost[];
  onUpdate: () => void;
  type: "current" | "proposed";
}) {
  const ensureSix = async () => {
    const existing = posts.filter((p) => p.type === type);
    const missing = [];
    for (let i = 0; i < 6; i++) {
      if (!existing.find((p) => p.position === i)) {
        missing.push({ client_id: clientId, type, position: i });
      }
    }
    if (missing.length) {
      await supabase.from("instagram_posts").insert(missing);
      onUpdate();
    }
  };

  useEffect(() => { ensureSix(); }, [clientId, type, posts.length]);

  const slots = Array.from({ length: 6 }, (_, i) => posts.find((p) => p.type === type && p.position === i));

  const update = async (id: string, patch: Partial<IGPost>) => {
    await supabase.from("instagram_posts").update(patch).eq("id", id);
    onUpdate();
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
                defaultValue={p.image_url ?? ""}
                onBlur={(e) => e.target.value !== (p.image_url ?? "") && update(p.id, { image_url: e.target.value || null })}
              />
              {p.image_url && (
                <div className="aspect-square rounded-lg bg-muted overflow-hidden">
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <Textarea
                placeholder="Caption…"
                defaultValue={p.caption ?? ""}
                rows={2}
                onBlur={(e) => e.target.value !== (p.caption ?? "") && update(p.id, { caption: e.target.value || null })}
              />
              <Input
                type="datetime-local"
                defaultValue={p.scheduled_at ? new Date(p.scheduled_at).toISOString().slice(0, 16) : ""}
                onBlur={(e) => {
                  const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                  if (v !== p.scheduled_at) update(p.id, { scheduled_at: v });
                }}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}
