import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X, Building2, Globe, Share2, ShoppingBag, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MediaUpload } from "@/components/MediaUpload";
import { syncWhatsAppProfile } from "@/lib/whatsapp/syncProfile.functions";
import type { WAAccount } from "@/routes/_app/clients/$clientId/chatbot";

type Social = { label: string; url: string };
type CatalogItem = { name: string; price?: string; url?: string; image_url?: string };
type HourRow = { day: number; enabled: boolean; open: string; close: string };

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function defaultHours(): HourRow[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day: i,
    enabled: i < 5,
    open: "09:00",
    close: "18:00",
  }));
}

export function BusinessProfileTab({
  account,
  onChange,
}: {
  account: WAAccount;
  onChange: () => void;
}) {
  const [photo, setPhoto] = useState(account.profile_photo_url ?? "");
  const [website, setWebsite] = useState(account.website_url ?? "");
  const [name, setName] = useState(account.business_name ?? "");
  const [hours, setHours] = useState<HourRow[]>(
    Array.isArray(account.business_hours) && account.business_hours.length === 7
      ? (account.business_hours as HourRow[])
      : defaultHours(),
  );
  const [socials, setSocials] = useState<Social[]>(
    Array.isArray(account.social_links) ? (account.social_links as Social[]) : [],
  );
  const [catalog, setCatalog] = useState<CatalogItem[]>(
    Array.isArray(account.catalog) ? (account.catalog as CatalogItem[]) : [],
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPhoto(account.profile_photo_url ?? "");
    setWebsite(account.website_url ?? "");
    setName(account.business_name ?? "");
    setHours(
      Array.isArray(account.business_hours) && account.business_hours.length === 7
        ? (account.business_hours as HourRow[])
        : defaultHours(),
    );
    setSocials(Array.isArray(account.social_links) ? (account.social_links as Social[]) : []);
    setCatalog(Array.isArray(account.catalog) ? (account.catalog as CatalogItem[]) : []);
  }, [account.id]);

  const syncFn = useServerFn(syncWhatsAppProfile);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("whatsapp_accounts")
      .update({
        profile_photo_url: photo || null,
        website_url: website || null,
        business_name: name.trim() || null,
        business_hours: hours,
        social_links: socials.filter((s) => s.url.trim()),
        catalog: catalog.filter((c) => c.name.trim()),
      } as any)
      .eq("id", account.id);
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }
    toast.success("Perfil guardado. Sincronizando con WhatsApp…");
    try {
      const res = (await syncFn({ data: { accountId: account.id } })) as {
        synced: { websites: number; description: boolean; about: boolean; photo: boolean; photoAttempted: boolean };
        actual: { about?: string; description?: string; websites?: string[]; profile_picture_url?: string } | null;
        warnings: string[];
      };
      const bits: string[] = [];
      if (res.synced.websites) bits.push(`${res.synced.websites} enlace(s)`);
      if (res.synced.about) bits.push("bio");
      if (res.synced.description) bits.push("descripción");
      if (res.synced.photo) bits.push("foto");
      toast.success(
        bits.length
          ? `Enviado a WhatsApp: ${bits.join(", ")}.`
          : "Perfil de WhatsApp actualizado.",
      );
      if (res.actual) {
        const stored: string[] = [];
        if (res.actual.about) stored.push(`bio="${res.actual.about.slice(0, 40)}…"`);
        if (res.actual.websites?.length) stored.push(`${res.actual.websites.length} web(s)`);
        if (res.actual.profile_picture_url) stored.push("foto ✓");
        if (stored.length) toast.message(`Meta confirma: ${stored.join(" · ")}`);
      }
      for (const w of res.warnings ?? []) toast.warning(w);
    } catch (e: any) {
      toast.error(`No se pudo sincronizar con WhatsApp: ${e?.message ?? "error"}`);
    } finally {
      setSaving(false);
      onChange();
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> Perfil del negocio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid md:grid-cols-[160px,1fr] gap-4 items-start">
            <div>
              <Label className="text-xs">Foto de perfil</Label>
              <MediaUpload
                clientId={account.client_id}
                value={photo || null}
                onChange={(url) => setPhoto(url ?? "")}
                placeholder="Sube o pega URL"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1">
                <Globe className="w-3 h-3" /> Sitio web
              </Label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://tunegocio.com"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                El bot lo puede compartir y usarlo como referencia al responder.
              </p>
            </div>
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1 mb-1">
              <Share2 className="w-3 h-3" /> Redes sociales
            </Label>
            <div className="space-y-2">
              {socials.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={s.label}
                    onChange={(e) => {
                      const next = [...socials];
                      next[i] = { ...next[i], label: e.target.value };
                      setSocials(next);
                    }}
                    placeholder="Instagram"
                    className="max-w-[180px]"
                  />
                  <Input
                    value={s.url}
                    onChange={(e) => {
                      const next = [...socials];
                      next[i] = { ...next[i], url: e.target.value };
                      setSocials(next);
                    }}
                    placeholder="https://instagram.com/tunegocio"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSocials(socials.filter((_, j) => j !== i))}
                    className="h-9 w-9"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSocials([...socials, { label: "", url: "" }])}
              className="mt-2"
            >
              <Plus className="w-3 h-3 mr-1" /> Añadir red
            </Button>
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1 mb-1">
              <ShoppingBag className="w-3 h-3" /> Catálogo de productos / servicios
            </Label>
            <div className="space-y-2">
              {catalog.map((it, i) => (
                <div key={i} className="border rounded-md p-2 bg-muted/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">#{i + 1}</span>
                    <Input
                      value={it.name}
                      onChange={(e) => {
                        const next = [...catalog];
                        next[i] = { ...next[i], name: e.target.value };
                        setCatalog(next);
                      }}
                      placeholder="Nombre del producto o servicio"
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setCatalog(catalog.filter((_, j) => j !== i))}
                      className="h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={it.price ?? ""}
                      onChange={(e) => {
                        const next = [...catalog];
                        next[i] = { ...next[i], price: e.target.value };
                        setCatalog(next);
                      }}
                      placeholder="Precio (ej: $25.000)"
                    />
                    <Input
                      value={it.url ?? ""}
                      onChange={(e) => {
                        const next = [...catalog];
                        next[i] = { ...next[i], url: e.target.value };
                        setCatalog(next);
                      }}
                      placeholder="Enlace al producto"
                    />
                  </div>
                  <MediaUpload
                    clientId={account.client_id}
                    value={it.image_url || null}
                    onChange={(url) => {
                      const next = [...catalog];
                      next[i] = { ...next[i], image_url: url ?? undefined };
                      setCatalog(next);
                    }}
                    placeholder="URL de la imagen"
                  />
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCatalog([...catalog, { name: "" }])}
              className="mt-2"
            >
              <Plus className="w-3 h-3 mr-1" /> Añadir producto
            </Button>
            <p className="text-[11px] text-muted-foreground mt-2">
              El asistente de IA usa esta información para responder con datos reales del negocio.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar perfil"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
