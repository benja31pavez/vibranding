import { graphBase } from "@/lib/meta/version";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  socialDisplay,
  summarizeHours,
  uploadProfilePhotoHandle,
  type CatalogItem,
  type HourRow,
  type Social,
} from "./profileSync.server";
import { getWaSecret } from "./tokens.server";

const META = graphBase();

export const syncWhatsAppProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string }) => input)
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Solo editores de la agencia dueña del cliente (no viewers ni el cliente).
    const { assertCanEditWhatsAppAccount } = await import("./accountAccess.server");
    await assertCanEditWhatsAppAccount(userId, data.accountId);

    const { data: acc } = await supabaseAdmin
      .from("whatsapp_accounts")
      .select(
        "id,client_id,phone_number_id,profile_photo_url,website_url,social_links,catalog,business_name,business_hours",
      )
      .eq("id", data.accountId)
      .maybeSingle();

    if (!acc) throw new Error("Cuenta no encontrada");
    const accessToken = await getWaSecret(data.accountId, "access_token");
    if (!acc.phone_number_id || !accessToken) {
      throw new Error("La cuenta de WhatsApp aún no está conectada");
    }

    const socials = (Array.isArray(acc.social_links) ? acc.social_links : []) as Social[];
    const catalog = (Array.isArray(acc.catalog) ? acc.catalog : []) as CatalogItem[];
    const hours = (Array.isArray(acc.business_hours) ? acc.business_hours : []) as HourRow[];
    const hoursSummary = summarizeHours(hours);

    // Build websites array (Meta allows up to 2)
    const websites: string[] = [];
    if (acc.website_url) websites.push(acc.website_url.trim());
    for (const s of socials) {
      if (websites.length >= 2) break;
      if (s?.url?.trim()) websites.push(s.url.trim());
    }

    // "About" — short visible bio under the contact name (max 139 chars).
    const aboutParts: string[] = [];
    if (acc.business_name) aboutParts.push(acc.business_name);
    if (acc.website_url) aboutParts.push(acc.website_url);
    for (const s of socials) {
      if (s?.url?.trim()) aboutParts.push(`${s.label || "Red"}: ${s.url}`);
    }
    const about = aboutParts.join(" · ").slice(0, 139);

    // "Description" — long description shown on the business profile screen.
    const descParts: string[] = [];
    if (acc.business_name) descParts.push(acc.business_name);
    if (hoursSummary) {
      descParts.push(`Horario: ${hoursSummary}`);
    }
    if (socials.length) {
      descParts.push(
        socials
          .filter((s) => s?.url?.trim())
          .map(socialDisplay)
          .join(" · "),
      );
    }
    if (catalog.length) {
      descParts.push(
        "Catálogo: " +
          catalog
            .filter((c) => c?.name?.trim())
            .slice(0, 6)
            .map((c) => (c.price ? `${c.name} (${c.price})` : c.name))
            .join(", "),
      );
    }
    const description = descParts.join("\n").slice(0, 512);

    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
    };
    if (websites.length) body.websites = websites;
    if (description) body.description = description;
    if (about) body.about = about;

    // Optional: profile photo upload (Meta only accepts JPG/JPEG)
    const warnings: string[] = [];
    let photoAttempted = false;
    if (acc.profile_photo_url) {
      photoAttempted = true;
      const appId = process.env.META_APP_ID;
      const lower = acc.profile_photo_url.toLowerCase().split("?")[0];
      const isJpg = lower.endsWith(".jpg") || lower.endsWith(".jpeg");
      if (!appId) {
        warnings.push("Foto no sincronizada: falta META_APP_ID en el servidor.");
      } else if (!isJpg) {
        warnings.push(
          "WhatsApp solo acepta fotos de perfil en formato JPG/JPEG. Vuelve a subir la imagen como .jpg.",
        );
      } else {
        const handle = await uploadProfilePhotoHandle(appId, accessToken, acc.profile_photo_url);
        if (handle) {
          body.profile_picture_handle = handle;
        } else {
          warnings.push("No se pudo subir la foto de perfil a Meta.");
        }
      }
    }
    if (acc.business_name) {
      warnings.push(
        "El nombre grande que aparece arriba en WhatsApp solo lo cambia Meta Business Manager después de revisión; aquí queda actualizado en bio/descripción y para la IA.",
      );
    }

    const res = await fetch(`${META}/${acc.phone_number_id}/whatsapp_business_profile`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Meta rechazó la actualización: ${msg}`);
    }

    // Read back what Meta actually has stored so the user can verify in the UI.
    let actual: {
      about?: string;
      description?: string;
      websites?: string[];
      profile_picture_url?: string;
    } | null = null;
    try {
      const verifyRes = await fetch(
        `${META}/${acc.phone_number_id}/whatsapp_business_profile?fields=about,description,websites,profile_picture_url&access_token=${accessToken}`,
      );
      const verifyJson: any = await verifyRes.json().catch(() => ({}));
      const row = verifyJson?.data?.[0];
      actual = row
        ? {
            about: typeof row.about === "string" ? row.about : undefined,
            description: typeof row.description === "string" ? row.description : undefined,
            websites: Array.isArray(row.websites)
              ? row.websites.filter((x: unknown) => typeof x === "string")
              : undefined,
            profile_picture_url:
              typeof row.profile_picture_url === "string" ? row.profile_picture_url : undefined,
          }
        : null;
    } catch {
      // best-effort
    }

    return {
      ok: true,
      synced: {
        websites: websites.length,
        description: !!description,
        about: !!about,
        photo: !!body.profile_picture_handle,
        photoAttempted,
      },
      actual,
      warnings,
      userId,
    };
  });
