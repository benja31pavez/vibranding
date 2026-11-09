/**
 * Datos de los leads de un cliente (pantalla Leads de la agencia).
 *
 * Un lead puede venir de cuatro tablas/orígenes reales:
 *  - `whatsapp_conversations` marcadas como lead o con seguimiento humano
 *    (canal `whatsapp` o `instagram` para DM de Instagram);
 *  - `landing_contact_submissions` (formulario de la landing);
 *  - `client_leads` (Meta Ads, Multienlace, y los que agrega la agencia a mano
 *    o el flujo del chatbot de WhatsApp).
 * El estado, las notas y las etiquetas viven en `lead_meta` (CHECK: whatsapp,
 * landing, meta_ads, multilink).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type LeadSource = "whatsapp" | "landing" | "meta_ads" | "multilink";
export type LeadStatus = "new" | "contacted" | "won" | "lost";
/** Canal de la conversación (solo para leads de `whatsapp_conversations`). */
export type LeadChannel = "whatsapp" | "instagram";

export interface Lead {
  source: LeadSource;
  source_id: string;
  name: string;
  /** Teléfono o correo. */
  contact: string;
  message: string | null;
  created_at: string;
  status: LeadStatus;
  notes: string | null;
  tags: string[];
  channel: LeadChannel | null;
}

export const LEAD_SOURCES: readonly LeadSource[] = ["whatsapp", "landing", "meta_ads", "multilink"];
export const LEAD_STATUSES: readonly LeadStatus[] = ["new", "contacted", "won", "lost"];

export const LEAD_STATUS_LABEL: Readonly<Record<LeadStatus, string>> = {
  new: "Nuevo",
  contacted: "Contactado",
  won: "Ganado",
  lost: "Perdido",
};

export const LEAD_STATUS_COLOR: Readonly<Record<LeadStatus, string>> = {
  new: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  contacted: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  won: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  lost: "bg-rose-500/15 text-rose-600 border-rose-500/30",
};

export const LEAD_SOURCE_LABEL: Readonly<Record<LeadSource, string>> = {
  whatsapp: "WhatsApp",
  landing: "Landing Page",
  meta_ads: "Meta Ads",
  multilink: "Multienlace",
};

export function isLeadSource(v: unknown): v is LeadSource {
  return typeof v === "string" && (LEAD_SOURCES as readonly string[]).includes(v);
}
export function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (LEAD_STATUSES as readonly string[]).includes(v);
}

/** Clave única del lead (origen + id en su tabla). */
export function leadKey(l: Pick<Lead, "source" | "source_id">): string {
  return `${l.source}:${l.source_id}`;
}

export const leadsKeys = {
  all: (userId: string, clientId: string) => ["client-leads", userId, clientId] as const,
};

type MetaRow = {
  source: string;
  source_id: string;
  status: string;
  notes: string | null;
  tags: string[] | null;
};

export async function loadLeads(clientId: string): Promise<Lead[]> {
  const [waRes, lpRes, extraRes, metaRes] = await Promise.all([
    supabase
      .from("whatsapp_conversations")
      .select(
        "id,channel,contact_name,contact_wa_id,last_message_preview,last_message_at,created_at,is_lead,needs_human_followup",
      )
      .eq("client_id", clientId)
      .or("is_lead.eq.true,needs_human_followup.eq.true")
      .order("last_message_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("landing_contact_submissions")
      .select("id,name,email,phone,message,created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("client_leads")
      .select("id,source,name,contact,email,message,created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_meta")
      .select("source,source_id,status,notes,tags")
      .eq("client_id", clientId),
  ]);

  const failed = [waRes, lpRes, extraRes, metaRes].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const meta = new Map<string, Pick<Lead, "status" | "notes" | "tags">>();
  for (const m of (metaRes.data ?? []) as MetaRow[]) {
    meta.set(`${m.source}:${m.source_id}`, {
      status: isLeadStatus(m.status) ? m.status : "new",
      notes: m.notes,
      tags: m.tags ?? [],
    });
  }
  const get = (s: LeadSource, id: string) =>
    meta.get(`${s}:${id}`) ?? { status: "new" as LeadStatus, notes: null, tags: [] };

  const all: Lead[] = [
    ...(waRes.data ?? []).map((c) => ({
      source: "whatsapp" as const,
      source_id: c.id,
      name: c.contact_name || c.contact_wa_id,
      contact: c.contact_wa_id,
      message: c.last_message_preview,
      created_at: c.last_message_at || c.created_at,
      channel: (c.channel === "instagram" ? "instagram" : "whatsapp") as LeadChannel,
      ...get("whatsapp", c.id),
    })),
    ...(lpRes.data ?? []).map((s) => ({
      source: "landing" as const,
      source_id: s.id,
      name: s.name,
      contact: [s.email, s.phone].filter(Boolean).join(" · "),
      message: s.message,
      created_at: s.created_at,
      channel: null,
      ...get("landing", s.id),
    })),
    ...(extraRes.data ?? []).map((s) => {
      const source: LeadSource = isLeadSource(s.source) ? s.source : "multilink";
      return {
        source,
        source_id: s.id,
        name: s.name,
        contact: s.contact ?? s.email ?? "",
        message: s.message,
        created_at: s.created_at,
        channel: null,
        ...get(source, s.id),
      };
    }),
  ];
  all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return all;
}

/** Leads del cliente (todas las fuentes) con caché por usuario. */
export function useClientLeads(clientId: string) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: leadsKeys.all(userId, clientId),
    enabled: Boolean(userId),
    queryFn: () => loadLeads(clientId),
  });
}

export type LeadMetaPatch = Partial<Pick<Lead, "status" | "notes" | "tags">>;

/**
 * Guarda estado/notas/etiquetas de un lead en `lead_meta` con actualización
 * optimista de la caché; si falla, revierte y devuelve el mensaje de error.
 */
export function useUpsertLeadMeta(clientId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = leadsKeys.all(user?.id ?? "", clientId);

  return async (lead: Lead, patch: LeadMetaPatch): Promise<string | null> => {
    const next = { ...lead, ...patch };
    const same = (l: Lead) => l.source === lead.source && l.source_id === lead.source_id;
    const previous = queryClient.getQueryData<Lead[]>(key);
    queryClient.setQueryData<Lead[]>(key, (ls) =>
      ls?.map((l) => (same(l) ? { ...l, ...patch } : l)),
    );

    const { error } = await supabase.from("lead_meta").upsert(
      {
        client_id: clientId,
        source: lead.source,
        source_id: lead.source_id,
        status: next.status,
        notes: next.notes,
        tags: next.tags,
      },
      { onConflict: "client_id,source,source_id" },
    );
    if (error) {
      // Revertir solo los campos de este patch, y solo si nadie los cambió después.
      queryClient.setQueryData<Lead[]>(key, (ls) =>
        ls?.map((l) => {
          if (!same(l)) return l;
          const restored: Lead = { ...l };
          const original = previous?.find(same) ?? lead;
          if ("status" in patch && l.status === patch.status) restored.status = original.status;
          if ("notes" in patch && l.notes === patch.notes) restored.notes = original.notes;
          if ("tags" in patch && l.tags === patch.tags) restored.tags = original.tags;
          return restored;
        }),
      );
      return error.message;
    }
    return null;
  };
}

/** "YYYY-MM" de un instante en hora de Chile. */
export function chileMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
  }).format(d);
}

export function countByStatus(leads: readonly Lead[]): Record<LeadStatus, number> {
  const c: Record<LeadStatus, number> = { new: 0, contacted: 0, won: 0, lost: 0 };
  for (const l of leads) c[l.status]++;
  return c;
}

/** Canal del lead para "Orígenes": WhatsApp e Instagram se separan por el canal de la conversación. */
export type LeadOriginKey = "whatsapp" | "instagram" | "landing" | "meta_ads" | "multilink";

export const LEAD_ORIGIN_LABEL: Readonly<Record<LeadOriginKey, string>> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram (DM)",
  landing: "Formulario web (landing)",
  meta_ads: "Meta Ads",
  multilink: "Multienlace",
};

export const LEAD_ORIGINS: readonly LeadOriginKey[] = [
  "whatsapp",
  "instagram",
  "landing",
  "meta_ads",
  "multilink",
];

export function leadOrigin(l: Lead): LeadOriginKey {
  if (l.source === "whatsapp" && l.channel === "instagram") return "instagram";
  return l.source;
}

export function countByOrigin(leads: readonly Lead[]): Record<LeadOriginKey, number> {
  const c: Record<LeadOriginKey, number> = {
    whatsapp: 0,
    instagram: 0,
    landing: 0,
    meta_ads: 0,
    multilink: 0,
  };
  for (const l of leads) c[leadOrigin(l)]++;
  return c;
}
