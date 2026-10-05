import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileField, SectionFooter } from "./ProfileField";
import { DEFAULT_JOB_TITLE, PENDING_MIGRATION_HINT, initialsOf } from "./profileUtils";
import { profileKeys, saveOwnerProfile, type OwnerDraft, type OwnerProfile } from "./profileData";

const AVATAR_BUCKET = "client-media";
/** Las políticas de INSERT del bucket exigen que la 1.ª carpeta sea el uid del usuario. */
const avatarPath = (userId: string, ext: string) => `${userId}/avatar-${Date.now()}.${ext}`;
const MAX_AVATAR_MB = 5;

interface PersonalSectionProps {
  userId: string;
  email: string;
  profile: OwnerProfile;
}

/** Datos personales del dueño: foto, nombre, cargo, teléfono/WhatsApp y email (solo lectura). */
export function PersonalSection({ userId, email, profile }: PersonalSectionProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<OwnerDraft>({
    full_name: profile.full_name ?? "",
    job_title: profile.job_title ?? DEFAULT_JOB_TITLE,
    phone: profile.phone ?? "",
    avatar_url: profile.avatar_url,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<OwnerDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Elige un archivo de imagen.");
    if (file.size > MAX_AVATAR_MB * 1024 * 1024) {
      return toast.error(`La foto debe pesar menos de ${MAX_AVATAR_MB} MB.`);
    }
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = avatarPath(userId, ext);
    const { error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (error) {
      console.error("[profile] error al subir la foto", error);
      return toast.error("No se pudo subir la foto", { description: error.message });
    }
    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    set({ avatar_url: data.publicUrl });
  };

  const save = async () => {
    setSaving(true);
    try {
      const { jobTitleSaved } = await saveOwnerProfile(userId, draft, profile.hasJobTitle);
      await queryClient.invalidateQueries({ queryKey: profileKeys.owner(userId) });
      window.dispatchEvent(new Event("profile-updated"));
      toast.success("Perfil actualizado", {
        description: jobTitleSaved
          ? undefined
          : "El cargo se guardará al aplicar la actualización.",
      });
    } catch (err) {
      console.error("[profile] error al guardar", err);
      toast.error("No se pudo guardar el perfil", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-center gap-4">
        <Avatar className="h-20 w-20 border bg-surface-2">
          {draft.avatar_url && <AvatarImage src={draft.avatar_url} alt="Foto de perfil" />}
          <AvatarFallback className="text-xl">{initialsOf(draft.full_name, email)}</AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAvatar(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
              {draft.avatar_url ? "Cambiar foto" : "Subir foto"}
            </Button>
            {draft.avatar_url && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set({ avatar_url: null })}
                disabled={uploading}
              >
                Quitar
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            JPG o PNG, máximo {MAX_AVATAR_MB} MB. Se ve en el menú de usuario.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <ProfileField
          id="profile-name"
          label="Nombre completo"
          value={draft.full_name}
          onChange={(v) => set({ full_name: v })}
          placeholder="Tu nombre"
          autoComplete="name"
          maxLength={120}
        />
        <ProfileField
          id="profile-job-title"
          label="Cargo"
          value={profile.hasJobTitle ? draft.job_title : DEFAULT_JOB_TITLE}
          onChange={(v) => set({ job_title: v })}
          placeholder={DEFAULT_JOB_TITLE}
          disabled={!profile.hasJobTitle}
          hint={profile.hasJobTitle ? "Aparece junto a tu nombre." : PENDING_MIGRATION_HINT}
          autoComplete="organization-title"
          maxLength={80}
        />
        <ProfileField
          id="profile-phone"
          label="Teléfono / WhatsApp"
          type="tel"
          value={draft.phone}
          onChange={(v) => set({ phone: v })}
          placeholder="+56 9 1234 5678"
          hint="Con código de país, para que te escriban por WhatsApp."
          autoComplete="tel"
          maxLength={30}
        />
        <ProfileField
          id="profile-email"
          label="Email de acceso"
          value={email}
          readOnly
          hint="Es tu usuario para entrar; no se cambia aquí."
        />
      </div>

      <div className="mt-auto">
        <SectionFooter>
          <Button onClick={() => void save()} disabled={saving || uploading}>
            {saving && <Loader2 className="animate-spin" />}
            {saving ? "Guardando…" : "Guardar datos personales"}
          </Button>
        </SectionFooter>
      </div>
    </div>
  );
}
