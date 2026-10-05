/**
 * Guardado del multienlace. Usa la RPC atómica `save_multilink` (migración
 * 20261012000500_sitio_publico.sql); si aún no está aplicada, guarda por partes
 * verificando que cada escritura afecte filas.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Multilink, MultilinkItem } from "@/lib/multilink";
import { diffItems, isTempId, itemPayload } from "@/lib/site/multilinkDraft";
import { slugify } from "@/lib/slug";
import { writeError } from "@/lib/writeCheck";

export type MultilinkSnapshot = { ml: Multilink; items: MultilinkItem[] };

export type SaveOutcome =
  | { ok: true; snapshot: MultilinkSnapshot }
  /** idMap: enlaces nuevos que sí alcanzaron a insertarse (para no duplicarlos al reintentar). */
  | { ok: false; message: string; idMap: Map<string, MultilinkItem> };

type RpcError = { code?: string; message: string };
type RpcCall = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: RpcError | null }>;

function isMissingFunction(err: RpcError): boolean {
  return (
    err.code === "PGRST202" || (err.code === "42883" && err.message.includes("save_multilink"))
  );
}

function profileRow(ml: Multilink, avatarFallback: string | null) {
  return {
    title: ml.title.trim(),
    bio: ml.bio?.trim() || null,
    avatar_url: ml.avatar_url ?? avatarFallback,
    theme_color: ml.theme_color,
    theme_mode: ml.theme_mode,
    button_style: ml.button_style,
    button_shape: ml.button_shape,
    font_family: ml.font_family,
    background: ml.background as Json,
    slug: slugify(ml.slug),
  };
}

export async function saveMultilink(
  saved: MultilinkSnapshot,
  draft: MultilinkSnapshot,
  avatarFallback: string | null,
): Promise<SaveOutcome> {
  const profile = profileRow(draft.ml, avatarFallback);
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall;
  const { data, error } = await rpc("save_multilink", {
    _page_id: draft.ml.id,
    _profile: profile,
    _items: draft.items.map((i, idx) => ({
      ...itemPayload(i, idx),
      id: isTempId(i.id) ? null : i.id,
    })),
  });
  if (!error) {
    const items = ((data as { items?: MultilinkItem[] } | null)?.items ?? []) as MultilinkItem[];
    return { ok: true, snapshot: { ml: { ...draft.ml, ...profile }, items } };
  }
  if (!isMissingFunction(error)) {
    return {
      ok: false,
      message:
        error.code === "42501" ? "no tienes permisos para editar este cliente" : error.message,
      idMap: new Map(),
    };
  }
  return saveByParts(saved, draft, profile);
}

async function saveByParts(
  saved: MultilinkSnapshot,
  draft: MultilinkSnapshot,
  profile: ReturnType<typeof profileRow>,
): Promise<SaveOutcome> {
  const { ml, items } = draft;
  const idMap = new Map<string, MultilinkItem>();
  const fail = (message: string): SaveOutcome => ({ ok: false, message, idMap });

  const taken = await supabase
    .from("multilinks")
    .select("id")
    .eq("slug", profile.slug)
    .neq("id", ml.id)
    .maybeSingle();
  if (taken.data) return fail(`la dirección /l/${profile.slug} ya la usa otro multienlace`);

  const mlErr = writeError(
    await supabase.from("multilinks").update(profile).eq("id", ml.id).select("id"),
  );
  if (mlErr) return fail(mlErr);

  const plan = diffItems(saved.items, items);
  if (plan.deletes.length) {
    const delErr = writeError(
      await supabase.from("multilink_items").delete().in("id", plan.deletes).select("id"),
      plan.deletes.length,
    );
    if (delErr) return fail(delErr);
  }
  if (plan.inserts.length) {
    const ins = await supabase
      .from("multilink_items")
      .insert(plan.inserts.map((x) => ({ ...x.row, multilink_id: ml.id, client_id: ml.client_id })))
      .select("*");
    const insErr = writeError(ins, plan.inserts.length);
    // insert().select() devuelve las filas en el mismo orden enviado.
    (ins.data ?? []).forEach((row, k) => idMap.set(plan.inserts[k].tempId, row as MultilinkItem));
    if (insErr) return fail(insErr);
  }
  const updates = await Promise.all(
    plan.updates.map((u) =>
      supabase.from("multilink_items").update(u.row).eq("id", u.id).select("id"),
    ),
  );
  const updErr = updates.map((r) => writeError(r)).find(Boolean);
  if (updErr) return fail(updErr);

  const nextItems = items.map((i, idx) => idMap.get(i.id) ?? { ...i, sort_order: idx });
  return { ok: true, snapshot: { ml: { ...ml, ...profile }, items: nextItems } };
}

/** Estado real en la BD (tras un fallo, para que el próximo guardado compare contra lo que existe). */
export async function fetchMultilinkSnapshot(id: string): Promise<MultilinkSnapshot | null> {
  const [m, it] = await Promise.all([
    supabase.from("multilinks").select("*").eq("id", id).maybeSingle(),
    supabase.from("multilink_items").select("*").eq("multilink_id", id).order("sort_order"),
  ]);
  if (m.error || it.error || !m.data) return null;
  return { ml: m.data as Multilink, items: (it.data ?? []) as MultilinkItem[] };
}
