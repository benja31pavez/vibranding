import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const META = "https://graph.facebook.com/v21.0";

type Social = { label: string; url: string };
type CatalogItem = { name: string; price?: string; url?: string; image_url?: string };

async function uploadProfilePhotoHandle(
  appId: string,
  accessToken: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    // 1) Download the image bytes
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await imgRes.arrayBuffer());

    // 2) Create an upload session
    const sessionRes = await fetch(
      `${META}/${appId}/uploads?file_length=${buf.byteLength}&file_type=${encodeURIComponent(
        contentType,
      )}&access_token=${accessToken}`,
      { method: "POST" },
    );
    const sessionJson: any = await sessionRes.json();
    if (!sessionRes.ok || !sessionJson?.id) {
      console.error("[wa-sync] upload session failed", sessionJson);
      return null;
    }

    // 3) Upload the binary, get the handle
    const upRes = await fetch(`${META}/${sessionJson.id}`, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${accessToken}`,
        file_offset: "0",
        "Content-Type": contentType,
      },
      body: buf,
    });
    const upJson: any = await upRes.json();
    if (!upRes.ok || !upJson?.h) {
      console.error("[wa-sync] upload bytes failed", upJson);
      return null;
    }
    return upJson.h as string;
  } catch (e: any) {
    console.error("[wa-sync] photo upload error", e?.message);
    return null;
  }
}

export const syncWhatsAppProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the user owns the account (via clients.user_id through RLS)
    const { data: owned } = await supabase
      .from("whatsapp_accounts")
      .select("id")
      .eq("id", data.accountId)
      .maybeSingle();
    if (!owned) throw new Error("No tienes acceso a esta cuenta");

    const { data: acc } = await supabaseAdmin
      .from("whatsapp_accounts")
      .select(
        "id,client_id,phone_number_id,access_token,profile_photo_url,website_url,social_links,catalog",
      )
      .eq("id", data.accountId)
      .maybeSingle();

    if (!acc) throw new Error("Cuenta no encontrada");
    if (!acc.phone_number_id || !acc.access_token) {
      throw new Error("La cuenta de WhatsApp aún no está conectada");
    }

    const socials = (Array.isArray(acc.social_links) ? acc.social_links : []) as Social[];
    const catalog = (Array.isArray(acc.catalog) ? acc.catalog : []) as CatalogItem[];

    // Build websites array (Meta allows up to 2)
    const websites: string[] = [];
    if (acc.website_url) websites.push(acc.website_url.trim());
    for (const s of socials) {
      if (websites.length >= 2) break;
      if (s?.url?.trim()) websites.push(s.url.trim());
    }

    // "About" — short visible bio under the contact name (max 139 chars).
    const aboutParts: string[] = [];
    if (acc.website_url) aboutParts.push(acc.website_url);
    for (const s of socials) {
      if (s?.url?.trim()) aboutParts.push(`${s.label || "Red"}: ${s.url}`);
    }
    const about = aboutParts.join(" · ").slice(0, 139);

    // "Description" — long description shown on the business profile screen.
    const descParts: string[] = [];
    if (socials.length) {
      descParts.push(
        socials
          .filter((s) => s?.url?.trim())
          .map((s) => `${s.label || "Red"}: ${s.url}`)
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
        const handle = await uploadProfilePhotoHandle(
          appId,
          acc.access_token,
          acc.profile_photo_url,
        );
        if (handle) {
          body.profile_picture_handle = handle;
        } else {
          warnings.push("No se pudo subir la foto de perfil a Meta.");
        }
      }
    }

    const res = await fetch(
      `${META}/${acc.phone_number_id}/whatsapp_business_profile`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${acc.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Meta rechazó la actualización: ${msg}`);
    }

    // Read back what Meta actually has stored so the user can verify in the UI.
    let actual: Record<string, unknown> | null = null;
    try {
      const verifyRes = await fetch(
        `${META}/${acc.phone_number_id}/whatsapp_business_profile?fields=about,description,websites,profile_picture_url&access_token=${acc.access_token}`,
      );
      const verifyJson: any = await verifyRes.json().catch(() => ({}));
      actual = verifyJson?.data?.[0] ?? null;
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
