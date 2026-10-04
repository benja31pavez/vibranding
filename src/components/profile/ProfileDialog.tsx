import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { ErrorState, ListSkeleton, PAGE_CONTAINER_CLASS } from "@/components/app";
import { cn } from "@/lib/utils";

const AVATAR_BUCKET = "client-media";
/** Las políticas de INSERT del bucket exigen que la 1.ª carpeta sea el uid del usuario. */
const avatarPath = (userId: string, ext: string) => `${userId}/avatar-${Date.now()}.${ext}`;

export type ProfileData = { full_name: string | null; phone: string | null; avatar_url: string | null };

export function ProfilePage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // El formulario queda bloqueado hasta cargar: guardar antes borraría nombre y teléfono.
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoaded(false);
    setLoadError(null);
    supabase.from("user_profiles").select("full_name,phone,avatar_url").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[profile] error al cargar", error);
          setLoadError("No pudimos cargar tu perfil. Revisa tu conexión e inténtalo de nuevo.");
          return;
        }
        setFullName(data?.full_name ?? "");
        setPhone(data?.phone ?? "");
        setAvatarUrl(data?.avatar_url ?? null);
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [user, reloadKey]);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = avatarPath(user.id, ext.toLowerCase());
    const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      console.error("[profile] error al subir la foto", upErr);
      return toast.error("No se pudo subir la foto", { description: upErr.message });
    }
    const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    setAvatarUrl(pub.publicUrl);
    setUploading(false);
  };

  const save = async () => {
    if (!user || !loaded) return;
    setSaving(true);
    const payload = { user_id: user.id, full_name: fullName.trim() || null, phone: phone.trim() || null, avatar_url: avatarUrl, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("user_profiles").upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error("No se pudo guardar el perfil", { description: error.message });
    toast.success("Perfil actualizado");
    window.dispatchEvent(new Event("profile-updated"));
  };

  const initials = (fullName || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className={cn(PAGE_CONTAINER_CLASS, "max-w-4xl")}>
      <header className="mb-10 border-b pb-6">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <UserRound className="h-4 w-4" /> Cuenta
        </div>
        <h1 className="text-3xl font-semibold">Editar perfil</h1>
        <p className="mt-2 text-sm text-muted-foreground">Actualiza tus datos personales y la imagen que verás en Vibranding.</p>
      </header>

      {loadError ? (
        <ErrorState message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />
      ) : !loaded ? (
        <ListSkeleton rows={4} label="Cargando tu perfil" />
      ) : (
      <div className="grid gap-10 md:grid-cols-[220px_minmax(0,1fr)]">
        <section>
          <Avatar className="h-32 w-32 border bg-surface shadow-sm">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="Foto de perfil" />}
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
              {avatarUrl ? "Cambiar foto" : "Subir foto"}
            </Button>
            {avatarUrl && <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarUrl(null)} disabled={uploading}>Quitar</Button>}
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nombre completo</Label>
            <Input id="profile-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tu nombre" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Teléfono</Label>
            <Input id="profile-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9 1234 5678" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={user?.email ?? ""} disabled />
            <p className="text-xs text-muted-foreground">El correo corresponde a tu acceso y no se puede cambiar aquí.</p>
          </div>
          <div className="flex justify-end border-t pt-6">
            <Button onClick={save} disabled={saving || uploading}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
          </div>
        </section>
      </div>
      )}
    </div>
  );
}
