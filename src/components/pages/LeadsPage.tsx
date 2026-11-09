import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  MessageCircle,
  Globe,
  Download,
  Search,
  Filter,
  Tag as TagIcon,
  X,
  Megaphone,
  Link2,
  Plus,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ErrorState, ListSkeleton } from "@/components/app";
import { chileToday } from "@/lib/dates/chile";
import {
  LEAD_STATUS_COLOR,
  LEAD_STATUS_LABEL,
  useClientLeads,
  useUpsertLeadMeta,
  type Lead,
  type LeadSource as Source,
  type LeadStatus as Status,
} from "@/components/leads/leadsData";

const STATUS_LABEL = LEAD_STATUS_LABEL;
const STATUS_COLOR = LEAD_STATUS_COLOR;

export interface LeadsPageProps {
  clientId: string;
  /**
   * "embedded": dentro de la pantalla con subsecciones (sin h1 ni tarjetas de
   * conteo, que ya muestran Resumen y Embudo). Por defecto, la página completa.
   */
  variant?: "full" | "embedded";
}

export function LeadsPage({ clientId, variant = "full" }: LeadsPageProps) {
  const query = useClientLeads(clientId);
  const leads = useMemo(() => query.data ?? [], [query.data]);
  const loading = query.isPending;
  const loadError = query.error?.message ?? null;
  const load = () => void query.refetch();
  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<"all" | Source>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");
  const [editing, setEditing] = useState<Lead | null>(null);
  const saveMeta = useUpsertLeadMeta(clientId);

  const upsertMeta = async (
    lead: Lead,
    patch: Partial<Pick<Lead, "status" | "notes" | "tags">>,
  ) => {
    const same = (l: Lead) => l.source === lead.source && l.source_id === lead.source_id;
    setEditing((cur) => (cur && same(cur) ? { ...cur, ...patch } : cur));
    const error = await saveMeta(lead, patch);
    if (error) {
      setEditing((cur) => {
        if (!cur || !same(cur)) return cur;
        const restored = { ...cur };
        if ("status" in patch && cur.status === patch.status) restored.status = lead.status;
        if ("notes" in patch && cur.notes === patch.notes) restored.notes = lead.notes;
        if ("tags" in patch && cur.tags === patch.tags) restored.tags = lead.tags;
        return restored;
      });
      toast.error(`No se pudo guardar el lead: ${error}`);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (filterSource !== "all" && l.source !== filterSource) return false;
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (
        q &&
        !`${l.name} ${l.contact} ${l.message ?? ""} ${l.tags.join(" ")}`.toLowerCase().includes(q)
      )
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
        l.source,
        l.name,
        l.contact,
        STATUS_LABEL[l.status],
        l.tags.join("|"),
        (l.notes ?? "").replace(/\n/g, " "),
        (l.message ?? "").replace(/\n/g, " "),
        new Date(l.created_at).toISOString(),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${chileToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        {variant === "full" ? (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
            <p className="text-sm text-muted-foreground">
              Todos los leads del cliente: Meta Ads, Multienlace, Landing Page y WhatsApp en un solo
              lugar.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {leads.length} {leads.length === 1 ? "lead" : "leads"} en total; filtra por origen o
            estado y toca uno para editarlo.
          </p>
        )}
        <div className="flex gap-2">
          <AddLeadDialog clientId={clientId} onCreated={load} />
          <Button variant="outline" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1" /> Exportar CSV
          </Button>
        </div>
      </header>

      {variant === "full" && (
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
      )}

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
          <SelectTrigger className="w-[180px]">
            <Filter className="w-3 h-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los orígenes</SelectItem>
            <SelectItem value="meta_ads">Meta Ads</SelectItem>
            <SelectItem value="multilink">Multienlace</SelectItem>
            <SelectItem value="landing">Landing Page</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
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
          onRetry={load}
          retrying={query.isFetching}
        />
      ) : loading ? (
        <ListSkeleton rows={5} label="Cargando leads" />
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
                type="button"
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
                      <Badge key={t} variant="secondary" className="text-[10px]">
                        {t}
                      </Badge>
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
                  <Select
                    value={editing.status}
                    onValueChange={(v) => upsertMeta(editing, { status: v as Status })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Añade y presiona Enter"
        />
        <Button variant="outline" onClick={add}>
          Añadir
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {value.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1">
            {t}
            <button
              type="button"
              aria-label={`Quitar etiqueta ${t}`}
              onClick={() => onChange(value.filter((x) => x !== t))}
            >
              <X aria-hidden className="w-3 h-3" />
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
    const { error } = await supabase.from("client_leads").insert({
      client_id: clientId,
      source,
      name: name.trim(),
      contact: contact.trim() || null,
      message: message.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Lead agregado");
    setName("");
    setContact("");
    setMessage("");
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-1" /> Nuevo lead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Origen</Label>
            <Select value={source} onValueChange={(v) => setSource(v as Source)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Crear lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
