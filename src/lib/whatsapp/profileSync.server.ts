import { graphBase } from "@/lib/meta/version";
const META = graphBase();

export type Social = { label: string; url: string };
export type CatalogItem = { name: string; price?: string; url?: string; image_url?: string };
export type HourRow = { day: number; enabled: boolean; open: string; close: string };

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function summarizeHours(hours: HourRow[]): string {
  if (!Array.isArray(hours) || hours.length === 0) return "";
  const rows = hours
    .slice()
    .sort((a, b) => a.day - b.day)
    .map((h) => ({
      label: DAY_NAMES[h.day] ?? `${h.day}`,
      value: h.enabled ? `${h.open}-${h.close}` : "cerrado",
    }));

  const groups: Array<{ start: string; end: string; value: string }> = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.value === row.value) last.end = row.label;
    else groups.push({ start: row.label, end: row.label, value: row.value });
  }

  return groups
    .map((g) => `${g.start === g.end ? g.start : `${g.start}-${g.end}`}: ${g.value}`)
    .join(" · ");
}

export function socialDisplay(social: Social): string {
  const raw = social.url.trim();
  const label = social.label?.trim() || "Red";
  try {
    const url = new URL(raw);
    const handle = url.pathname.replace(/^\/+|\/+$/g, "");
    return handle ? `${label}: @${handle}` : `${label}: ${url.hostname}`;
  } catch {
    return `${label}: ${raw}`;
  }
}

export async function uploadProfilePhotoHandle(
  appId: string,
  accessToken: string,
  imageUrl: string,
): Promise<string | null> {
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await imgRes.arrayBuffer());

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
