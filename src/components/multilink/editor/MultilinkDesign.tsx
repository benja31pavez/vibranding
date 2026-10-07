import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, ImageUploadButton } from "@/components/site/fields";
import type { Multilink } from "@/lib/multilink";
import { slugify } from "@/lib/slug";
import type { ItemErrors } from "@/lib/site/multilinkDraft";
import { displayUrl, multilinkPublicUrlFor } from "@/lib/site/siteStatus";
import { meaningfulBio } from "@/components/multilink/bio";

type Props = {
  ml: Multilink;
  onChange: (next: Multilink) => void;
  errors: ItemErrors;
  clientId: string;
  avatarFallback: string | null;
  /** De dónde sale la foto por defecto (si no se sube una propia). */
  avatarSource: "logo" | "instagram" | null;
  /** Descripción del negocio en la ficha: se ofrece si la del multienlace está vacía. */
  clientDescription: string | null;
  /** Publicado: cambiar la dirección rompería el link y el QR ya compartidos. */
  published: boolean;
};

const BIO_MAX = 200;

export function ProfileEditor({
  ml,
  onChange,
  errors,
  clientId,
  avatarFallback,
  avatarSource,
  clientDescription,
  published,
}: Props) {
  // "vibranding.pro" como dirección se lee como un dominio: vibranding.pro/l/vibranding.pro.
  const dottedSlug = slugify(ml.slug).includes(".");
  const cleanSlug = slugify(ml.slug).replace(/\./g, "-");
  const avatar = ml.avatar_url ?? avatarFallback;
  const bio = ml.bio ?? "";
  const bioIsJunk = bio.trim().length > 0 && !meaningfulBio(bio);
  const offerDescription = !!clientDescription && (!bio.trim() || bioIsJunk);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 rounded-app-lg border border-border-subtle bg-surface-2/40 p-3">
        <div
          className="shrink-0 rounded-full p-[2px]"
          style={{ background: ml.theme_color }}
          aria-hidden={!avatar}
        >
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border-2 border-surface bg-secondary text-xl font-semibold">
            {avatar ? (
              <img
                src={avatar}
                alt="Foto de perfil"
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            ) : (
              ml.title[0] || "?"
            )}
          </div>
        </div>
        <div className="min-w-0 space-y-1.5">
          <ImageUploadButton
            clientId={clientId}
            label={avatar ? "Cambiar logo o foto" : "Subir logo o foto"}
            onUploaded={([url]) => onChange({ ...ml, avatar_url: url })}
          />
          <p className="text-xs text-muted-foreground">
            {!ml.avatar_url && avatarFallback && avatarSource
              ? avatarSource === "logo"
                ? "Usando el logo del cliente."
                : "Usando la foto de Instagram."
              : "Cuadrada, de al menos 400 × 400 px."}
          </p>
        </div>
      </div>
      <Field label="Nombre" error={errors.title}>
        {(a) => (
          <Input
            {...a}
            value={ml.title}
            maxLength={80}
            onChange={(e) => onChange({ ...ml, title: e.target.value })}
          />
        )}
      </Field>
      <Field
        label="Descripción corta"
        error={bioIsJunk ? "Parece incompleta: no se mostrará" : undefined}
        hint={`${bio.length}/${BIO_MAX} · Qué hace el negocio y dónde`}
      >
        {(a) => (
          <Textarea
            {...a}
            rows={2}
            maxLength={BIO_MAX}
            placeholder="Paisajismo y mantención de jardines en Las Condes y Vitacura"
            value={ml.bio ?? ""}
            onChange={(e) => onChange({ ...ml, bio: e.target.value })}
          />
        )}
      </Field>
      {offerDescription && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onChange({ ...ml, bio: clientDescription!.slice(0, BIO_MAX) })}
          title={clientDescription!}
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Usar la descripción de la
          ficha
        </Button>
      )}
      <Field
        label="Dirección del multienlace"
        error={errors.slug}
        hint={displayUrl(multilinkPublicUrlFor({ ...ml, slug: slugify(ml.slug) || "…" }))}
      >
        {(a) => (
          <Input
            {...a}
            value={ml.slug}
            maxLength={60}
            onChange={(e) => onChange({ ...ml, slug: e.target.value })}
            onBlur={() => onChange({ ...ml, slug: slugify(ml.slug) || ml.slug })}
          />
        )}
      </Field>
      {dottedSlug && !published && (
        <Button size="sm" variant="outline" onClick={() => onChange({ ...ml, slug: cleanSlug })}>
          Usar /l/{cleanSlug} (sin puntos)
        </Button>
      )}
    </div>
  );
}

export { ThemeEditor } from "@/components/multilink/editor/ThemeEditor";
