import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { MessageCircle, Globe, Download, Search, Filter, Tag as TagIcon, X, Megaphone, Link2, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ErrorState } from "@/components/app";


type Source = "whatsapp" | "landing" | "meta_ads" | "multilink";
type Status = "new" | "contacted" | "won" | "lost";

type Lead = {
  source: Source;
  source_id: string;
  name: string;
  contact: string; // phone or email
  message: string | null;
  created_at: string;
  status: Status;
  notes: string | null;
  tags: string[];
};

const STATUS_LABEL: Record<Status, string> = {
  new: "Nuevo", contacted: "Contactado", won: "Ganado", lost: "Perdido",
};
const STATUS_COLOR: Record<Status, string> = {
  new: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  contacted: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  won: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  lost: "bg-rose-500/15 text-rose-600 border-rose-500/30",
};

export function LeadsPage({ clientId }: { clientId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<"all" | Source>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");
  const [editing, setEditing] = useState<Lead | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const [waRes, lpRes, extraRes, metaRes] = await Promise.all([
      supabase
        .from("whatsapp_conversations")
        .select("id,contact_name,contact_wa_id,last_message_preview,last_message_at,created_at,is_lead,needs_human_followup")
        .eq("client_id", clientId)
        .or("is_lead.eq.true,needs_human_followup.eq.true")
        .order("last_message_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("landing_contact_submissions")
        .select("id,name,email,phone,message,created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      (supabase.from("client_leads" as any) as any)
        .select("id,source,name,contact,message,created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false }),
      (supabase.from("lead_meta" as any) as any)
        .select("source,source_id,status,notes,tags")
        .eq("client_id", clientId),
    ]);

    const failed = [waRes, lpRes, extraRes, metaRes].find((r: any) => r.error) as any;
    if (failed) {
      setLoadError(failed.error.message);
      setLoading(false);
      return;
    }

    const meta = new Map<string, { status: Status; notes: string | null; tags: string[] }>();
    for (const m of (metaRes.data ?? []) as any[]) {
      meta.set(`${m.source}:${m.source_id}`, {
        status: m.status, notes: m.notes, tags: m.tags ?? [],
      });
    }
    const get = (s: Source, id: string) =>
      meta.get(`${s}:${id}`) ?? { status: "new" as Status, notes: null, tags: [] };

    const all: Lead[] = [
      ...((waRes.data ?? []) as any[]).map((c) => ({
        source: "whatsapp" as Source,
        source_id: c.id,
        name: c.contact_name || c.contact_wa_id,
        contact: c.contact_wa_id,
        message: c.last_message_preview,
        created_at: c.last_message_at || c.created_at,
        ...get("whatsapp", c.id),
      })),
      ...((lpRes.data ?? []) as any[]).map((s) => ({
        source: "landing" as Source,
        source_id: s.id,
        name: s.name,
        contact: [s.email, s.phone].filter(Boolean).join(" · "),
        message: s.message,
        created_at: s.created_at,
        ...get("landing", s.id),
      })),
      ...((extraRes.data ?? []) as any[]).map((s) => ({
        source: s.source as Source,
        source_id: s.id,
        name: s.name,
        contact: s.contact ?? "",
        message: s.message,
        created_at: s.created_at,
        ...get(s.source as Source, s.id),
      })),
    ];
    all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    setLeads(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const upsertMeta = async (lead: Lead, patch: Partial<Pick<Lead, "status" | "notes" | "tags">>) => {
    const next = { ...lead, ...patch };
    const same = (l: Lead) => l.source === lead.source && l.source_id === lead.source_id;
    setLeads((ls) => ls.map((l) => (same(l) ? next : l)));
    const { error } = await (supabase.from("lead_meta" as any) as any).upsert({
      client_id: clientId,
      source: lead.source,
      source_id: lead.source_id,
      status: next.status,
      notes: next.notes,
      tags: next.tags,
    }, { onConflict: "client_id,source,source_id" });
    if (error) {
      // Revertir el cambio optimista: el estado en pantalla no debe mentir.
      setLeads((ls) => ls.map((l) => (same(l) ? lead : l)));
      setEditing((cur) => (cur && same(cur) ? lead : cur));
      toast.error(`No se pudo guardar el lead: ${error.message}`);
      return;
    }
    setEditing((cur) => (cur && same(cur) ? next : cur));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filterSource !== "all" && l.source !== filterSource) return false;
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (q && !`${l.name} ${l.contact} ${l.message ?? ""} ${l.tags.join(" ")}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [leads, search, filterSource, filterStatus]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { new: 0, contacted: 0, won: 0, lost: 0 };
    for (const l of leads) c[l.status]++;
    return c;
  }, [leads]);

  const exportCsv = () => {
    const rows = [
      ["Origen", "Nombre", "Contacto", "Estado", "Etiquetas", "Notas", "Mensaje", "Fecha"],
      ...filtered.map((l) => [
        l.source, l.name, l.contact, STATUS_LABEL[l.status],
        l.tags.join("|"), (l.notes ?? "").replace(/\n/g, " "),
        (l.message ?? "").replace(/\n/g, " "),
        new Date(l.created_at).toISOString(),
      ]),
    ];
    const csv = rows.map((r) =>
      r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Todos los leads del cliente: Meta Ads, Multienlace, Landing Page y WhatsApp en un solo lugar.
          </p>
        </div>
        <div className="flex gap-2">
          <AddLeadDialog clientId={clientId} onCreated={load} />
          <Button variant="outline" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(counts) as Status[]).map((s) => (
          <Card key={s}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{STATUS_LABEL[s]}</div>
              <div className="text-2xl font-semibold mt-1">{counts[s]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, contacto, etiqueta…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterSource} onValueChange={(v) => setFilterSource(v as any)}>
          <SelectTrigger className="w-[180px]"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los orígenes</SelectItem>
            <SelectItem value="meta_ads">Meta Ads</SelectItem>
            <SelectItem value="multilink">Multienlace</SelectItem>
            <SelectItem value="landing">Landing Page</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="new">Nuevo</SelectItem>
            <SelectItem value="contacted">Contactado</SelectItem>
            <SelectItem value="won">Ganado</SelectItem>
            <SelectItem value="lost">Perdido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loadError ? (
        <ErrorState
          title="No pudimos cargar los leads"
          message={loadError}
          onRetry={() => void load()}
          retrying={loading}
        />
      ) : loading ? (
        <div className="p-10 text-center text-muted-foreground">Cargando…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No hay leads que coincidan con el filtro.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {filtered.map((lead) => (
              <button
                key={`${lead.source}-${lead.source_id}`}
                onClick={() => setEditing(lead)}
                className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-full grid place-items-center shrink-0 bg-primary/10 text-primary">
                  <SourceIcon source={lead.source} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{lead.name}</span>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLOR[lead.status]}`}>
                      {STATUS_LABEL[lead.status]}
                    </Badge>
                    {lead.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {lead.contact} {lead.message ? `· ${lead.message}` : ""}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {lead.created_at ? new Date(lead.created_at).toLocaleDateString("es-CL") : ""}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <SourceIcon source={editing.source} />
                  {editing.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm">
                  <div className="text-xs text-muted-foreground">Contacto</div>
                  <div>{editing.contact}</div>
                </div>
                {editing.message && (
                  <div className="text-sm">
                    <div className="text-xs text-muted-foreground">Mensaje</div>
                    <div className="bg-muted/40 rounded p-3 mt-1 text-sm">{editing.message}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Estado</div>
                  <Select value={editing.status} onValueChange={(v) => upsertMeta(editing, { status: v as Status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Nuevo</SelectItem>
                      <SelectItem value="contacted">Contactado</SelectItem>
                      <SelectItem value="won">Ganado</SelectItem>
                      <SelectItem value="lost">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <TagEditor
                  value={editing.tags}
                  onChange={(tags) => upsertMeta(editing, { tags })}
                />
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Notas internas</div>
                  <Textarea
                    value={editing.notes ?? ""}
                    onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                    onBlur={() => upsertMeta(editing, { notes: editing.notes })}
                    rows={4}
                    placeholder="Anota detalles, próximos pasos, etc."
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TagEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim();
    if (!t || value.includes(t)) return setInput("");
    onChange([...value, t]);
    setInput("");
  };
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
        <TagIcon className="w-3 h-3" /> Etiquetas
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Añade y presiona Enter"
        />
        <Button variant="outline" onClick={add}>Añadir</Button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {value.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1">
            {t}
            <button onClick={() => onChange(value.filter((x) => x !== t))}>
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

function SourceIcon({ source }: { source: Source }) {
  if (source === "whatsapp") return <MessageCircle className="w-4 h-4" />;
  if (source === "landing") return <Globe className="w-4 h-4" />;
  if (source === "meta_ads") return <Megaphone className="w-4 h-4" />;
  return <Link2 className="w-4 h-4" />;
}

function AddLeadDialog({ clientId, onCreated }: { clientId: string; onCreated: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<Source>("meta_ads");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSaving(true);
    const { error } = await (supabase.from("client_leads" as any) as any).insert({
      client_id: clientId,
      source,
      name: name.trim(),
      contact: contact.trim() || null,
      message: message.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Lead agregado");
    setName(""); setContact(""); setMessage(""); setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-1" /> Nuevo lead</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nuevo lead</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Origen</Label>
            <Select value={source} onValueChange={(v) => setSource(v as Source)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="meta_ads">Meta Ads</SelectItem>
                <SelectItem value="multilink">Multienlace</SelectItem>
                <SelectItem value="landing">Landing Page</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Contacto (teléfono o email)</Label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mensaje / nota inicial</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Crear lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
