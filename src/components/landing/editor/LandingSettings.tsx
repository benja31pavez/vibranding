import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/site/fields";
import { landingCanonicalUrl, landingSeoDescription, landingSeoTitle } from "@/lib/site/landingSeo";
import { landingForView, type LandingDraft, type LandingErrors } from "@/lib/site/landingDraft";
import type { LandingFooter } from "@/lib/landingTheme";
import { slugify } from "@/lib/slug";

type Props = { lp: LandingDraft; onChange: (next: LandingDraft) => void; errors: LandingErrors };

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border bg-surface p-5">
      <div>
        <h2 className="font-medium">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function LandingSettings({ lp, onChange, errors }: Props) {
  const setFooter = (patch: Partial<LandingFooter>) =>
    onChange({ ...lp, footer: { ...lp.footer, ...patch } });
  const legal = lp.footer.legal ?? [];
  const view = landingForView(lp);
  const seoTitle = landingSeoTitle(view);
  const seoDescription = landingSeoDescription(view);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Card title="Dirección de la página" description="Sólo minúsculas, números y guiones.">
        <Field label="Slug" error={errors.slug} hint={landingCanonicalUrl(slugify(lp.slug) || "…")}>
          {(a) => (
            <Input
              {...a}
              value={lp.slug}
              maxLength={60}
              onChange={(e) => onChange({ ...lp, slug: e.target.value })}
              onBlur={() => onChange({ ...lp, slug: slugify(lp.slug) || lp.slug })}
            />
          )}
        </Field>
      </Card>

      <Card
        title="Google (SEO)"
        description="Si lo dejas vacío se usa el título y subtítulo, más la comuna."
      >
        <Field label="Título en Google" hint={`${(lp.seo_title ?? "").length}/60 caracteres`}>
          {(a) => (
            <Input
              {...a}
              maxLength={60}
              placeholder={seoTitle}
              value={lp.seo_title ?? ""}
              onChange={(e) => onChange({ ...lp, seo_title: e.target.value })}
            />
          )}
        </Field>
        <Field
          label="Descripción en Google"
          hint={`${(lp.seo_description ?? "").length}/160 caracteres`}
        >
          {(a) => (
            <Textarea
              {...a}
              rows={2}
              maxLength={160}
              placeholder={seoDescription}
              value={lp.seo_description ?? ""}
              onChange={(e) => onChange({ ...lp, seo_description: e.target.value })}
            />
          )}
        </Field>
        <div className="rounded-xl border bg-background p-4" aria-label="Así se vería en Google">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Search className="h-3 w-3" aria-hidden="true" /> Vista previa en Google
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {landingCanonicalUrl(slugify(lp.slug) || lp.slug)}
          </p>
          <p className="truncate text-lg text-[#1a0dab] dark:text-[#8ab4f8]">
            {seoTitle || "Título de la página"}
          </p>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {seoDescription || "Descripción de la página"}
          </p>
        </div>
      </Card>

      <Card title="Pie de página" description="Datos de contacto y redes del cliente.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Email" error={errors["footer.email"]}>
            {(a) => (
              <Input
                {...a}
                type="email"
                maxLength={160}
                value={lp.footer.email ?? ""}
                onChange={(e) => setFooter({ email: e.target.value })}
              />
            )}
          </Field>
          <Field label="Teléfono fijo (opcional)">
            {(a) => (
              <Input
                {...a}
                type="tel"
                maxLength={40}
                value={lp.footer.phone ?? ""}
                onChange={(e) => setFooter({ phone: e.target.value })}
              />
            )}
          </Field>
          <Field label="WhatsApp (si no usas la sección)" error={errors["footer.whatsapp"]}>
            {(a) => (
              <Input
                {...a}
                type="tel"
                placeholder="+56 9 1234 5678"
                maxLength={20}
                value={lp.footer.whatsapp ?? ""}
                onChange={(e) => setFooter({ whatsapp: e.target.value })}
              />
            )}
          </Field>
          <Field label="Dirección">
            {(a) => (
              <Input
                {...a}
                maxLength={200}
                value={lp.footer.address ?? ""}
                onChange={(e) => setFooter({ address: e.target.value })}
              />
            )}
          </Field>
          {(["instagram", "facebook", "tiktok"] as const).map((k) => (
            <Field
              key={k}
              label={k === "tiktok" ? "TikTok" : k[0].toUpperCase() + k.slice(1)}
              error={errors[`footer.${k}`]}
            >
              {(a) => (
                <Input
                  {...a}
                  inputMode="url"
                  placeholder={`https://${k}.com/…`}
                  maxLength={300}
                  value={lp.footer[k] ?? ""}
                  onChange={(e) => setFooter({ [k]: e.target.value })}
                />
              )}
            </Field>
          ))}
        </div>
        <div className="space-y-2">
          <span className="text-xs font-medium">Enlaces legales (opcional)</span>
          {legal.map((l, i) => (
            <div key={i} className="flex items-start gap-2">
              <Input
                aria-label={`Etiqueta del enlace legal ${i + 1}`}
                placeholder="Política de privacidad"
                maxLength={60}
                value={l.label}
                onChange={(e) =>
                  setFooter({
                    legal: legal.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)),
                  })
                }
              />
              <div className="flex-1">
                <Field label={`URL del enlace ${i + 1}`} error={errors[`footer.legal.${i}`]}>
                  {(a) => (
                    <Input
                      {...a}
                      placeholder="https://…"
                      maxLength={300}
                      value={l.url}
                      onChange={(e) =>
                        setFooter({
                          legal: legal.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)),
                        })
                      }
                    />
                  )}
                </Field>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Eliminar enlace legal ${i + 1}`}
                onClick={() => setFooter({ legal: legal.filter((_, k) => k !== i) })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFooter({ legal: [...legal, { label: "", url: "" }] })}
          >
            <Plus className="mr-1 h-4 w-4" /> Agregar enlace
          </Button>
        </div>
      </Card>
    </div>
  );
}
