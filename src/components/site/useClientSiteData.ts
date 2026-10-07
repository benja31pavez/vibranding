import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserKey } from "@/components/clients/ficha/fichaQueries";
import { normalizeChileMobile, normalizeUrl } from "@/lib/site/validation";
import { safeImageSrc, safeWebUrl } from "@/lib/site/safeUrl";

/**
 * Datos que el cliente ya entregó (ficha, onboarding y landing) para proponer
 * enlaces, avatar, descripción y colores en los editores del sitio. Nunca se
 * inventa nada: si un dato no existe o no es válido, queda en null.
 */
export type ClientSiteData = {
  logoUrl: string | null;
  description: string | null;
  instagramHandle: string | null;
  /** Celular chileno normalizado (+569XXXXXXXX) de la landing o del onboarding. */
  whatsapp: string | null;
  /** Redes del onboarding ya convertidas a URL https. */
  socials: Partial<Record<SocialKey, string>>;
  /** Colores hex del onboarding (#rrggbb), en el orden que los dio el cliente. */
  brandColors: string[];
  landing: { slug: string; published: boolean; mapsUrl: string | null } | null;
};

export type SocialKey = "instagram" | "facebook" | "tiktok" | "linkedin" | "youtube" | "x" | "web";

const EMPTY: ClientSiteData = {
  logoUrl: null,
  description: null,
  instagramHandle: null,
  whatsapp: null,
  socials: {},
  brandColors: [],
  landing: null,
};

const HANDLE_BASE: Partial<Record<SocialKey, string>> = {
  instagram: "https://instagram.com/",
  tiktok: "https://tiktok.com/@",
  youtube: "https://youtube.com/@",
  x: "https://x.com/",
  facebook: "https://facebook.com/",
};

/** "@usuario", "usuario" o una URL → URL https; null si no se puede armar sin adivinar. */
export function socialUrl(key: SocialKey, raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return safeWebUrl(v);
  if (key === "web") return safeWebUrl(normalizeUrl(v));
  const handle = v.replace(/^@/, "");
  // "instagram.com/usuario" sin https; un "@cafe.lunar" (sin "/") es un usuario con punto.
  if (handle.includes("/")) return safeWebUrl(normalizeUrl(handle));
  const base = HANDLE_BASE[key];
  if (!base || !/^[\w.]{1,60}$/.test(handle)) return null;
  return safeWebUrl(`${base}${handle}`);
}

/** "#abc" / "#AABBCC" / "aabbcc" → "#aabbcc"; nombres de color ("verde oliva") se ignoran. */
export function hexColor(raw: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toLowerCase()}`;
}

function mapsUrl(location: unknown): string | null {
  if (!location || typeof location !== "object") return null;
  const loc = location as { address?: string; comuna?: string };
  const query = [loc.address, loc.comuna]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(", ");
  if (!query || !(loc.address ?? "").trim()) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function parseSocials(value: unknown): Partial<Record<SocialKey, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const keys: SocialKey[] = ["instagram", "facebook", "tiktok", "linkedin", "youtube", "x", "web"];
  const out: Partial<Record<SocialKey, string>> = {};
  for (const key of keys) {
    const url = socialUrl(key, (value as Record<string, unknown>)[key] as string | undefined);
    if (url) out[key] = url;
  }
  return out;
}

async function fetchClientSiteData(clientId: string): Promise<ClientSiteData> {
  const [clientRes, intakeRes, landingRes] = await Promise.all([
    supabase
      .from("clients")
      .select("logo_url,business_description,instagram_handle")
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("client_intake")
      .select("contacto_telefono,links_redes,colores")
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("landing_pages")
      .select("slug,published,whatsapp_number,location")
      .eq("client_id", clientId)
      .maybeSingle(),
  ]);
  // Son sugerencias: si una consulta falla (p. ej. permisos), el editor sigue sin ellas.
  const client = clientRes.data;
  const intake = intakeRes.error ? null : intakeRes.data;
  const landing = landingRes.error ? null : landingRes.data;
  const handle = (client?.instagram_handle ?? "").trim().replace(/^@/, "") || null;
  const socials = parseSocials(intake?.links_redes);
  if (handle && !socials.instagram) {
    const ig = socialUrl("instagram", handle);
    if (ig) socials.instagram = ig;
  }
  return {
    logoUrl: safeImageSrc(client?.logo_url ?? null),
    description: client?.business_description?.trim() || null,
    instagramHandle: handle,
    whatsapp:
      normalizeChileMobile(landing?.whatsapp_number) ??
      normalizeChileMobile(intake?.contacto_telefono) ??
      null,
    socials,
    brandColors: [
      ...new Set((intake?.colores ?? []).map(hexColor).filter((c): c is string => !!c)),
    ],
    landing: landing
      ? { slug: landing.slug, published: landing.published, mapsUrl: mapsUrl(landing.location) }
      : null,
  };
}

export function useClientSiteData(clientId: string): ClientSiteData {
  const userKey = useUserKey();
  const { data } = useQuery({
    queryKey: ["sitio", "client-data", userKey, clientId],
    queryFn: () => fetchClientSiteData(clientId),
    staleTime: 60_000,
  });
  return data ?? EMPTY;
}

/**
 * Dirección pública a partir del @ de Instagram o del nombre: sin puntos, para que
 * "vibranding.pro" no se lea como un dominio dentro de la URL (vibranding.pro/l/vibranding-pro).
 */
export function slugSeed(handle: string | null | undefined, name: string): string {
  const base = (handle ?? "").trim().replace(/^@/, "") || name;
  return base.replace(/\./g, "-");
}
