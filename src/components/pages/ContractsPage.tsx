import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

/** RLS hides rows instead of erroring: 0 affected rows means "not allowed". */
const NO_PERMISSION = "No tienes permisos para esta acción";
function writeDenied(error: unknown, rows: unknown[] | null): boolean {
  return Boolean(error) || !rows || rows.length === 0;
}
import { FileSignature, Download, Trash2, Plus, FileText } from "lucide-react";
import {
  loadPricing, loadServicePricing, SERVICE_CATALOG,
  type PricingSettings, type ServicePricing, type ServiceKey,
} from "@/components/PricingPanel";
import { ContractDocument } from "@/components/contracts/ContractDocument";
import { exportElementToPdf } from "@/lib/exportPdf";


interface ClientContract {
  id: string;
  client_id: string;
  title: string;
  status: "draft" | "sent" | "signed" | "cancelled";
  currency: string;
  payment_due_days: number;
  agency_snapshot: any;
  client_snapshot: any;
  services_snapshot: any[];
  clauses_snapshot: any[];
  total_one_time: number;
  total_monthly: number;
  effective_date: string | null;
  signed_at: string | null;
  notes: string | null;
  created_at: string;
}

interface ClientRow {
  id: string;
  name: string;
  instagram_handle: string | null;
  notes: string | null;
  business_description: string | null;
}

export function ContractsPage({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const [client, setClient] = useState<ClientRow | null>(null);
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [services, setServices] = useState<Record<ServiceKey, ServicePricing> | null>(null);
  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [selected, setSelected] = useState<Set<ServiceKey>>(new Set());
  const [creating, setCreating] = useState(false);
  const [clientLegalName, setClientLegalName] = useState("");
  const [clientTaxId, setClientTaxId] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [previewing, setPreviewing] = useState<ClientContract | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("clients").select("id,name,instagram_handle,notes,business_description").eq("id", clientId).maybeSingle().then(({ data }) => setClient(data as any));
    loadPricing(user.id).then(setPricing);
    loadServicePricing(user.id).then(setServices);
    reloadContracts();
  }, [user, clientId]);

  const reloadContracts = async () => {
    const { data } = await supabase.from("client_contracts").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
    setContracts((data ?? []) as any);
  };

  const toggleService = (k: ServiceKey) => {
    const s = new Set(selected);
    s.has(k) ? s.delete(k) : s.add(k);
    setSelected(s);
  };

  const buildClauses = (p: PricingSettings) => {
    const list: { title: string; body: string }[] = [];
    if (p.clause_esim) list.push({ title: "eSIM / teléfono dedicado", body: p.clause_esim });
    if (p.clause_meta_api) list.push({ title: "Uso responsable Meta API / WhatsApp", body: p.clause_meta_api });
    if (p.clause_late_payment) list.push({ title: "Mora / suspensión por impago", body: p.clause_late_payment });
    if (p.clause_extra) list.push({ title: "Cláusulas adicionales", body: p.clause_extra });
    return list;
  };

  const createContract = async () => {
    if (!pricing || !services || !client) return;
    if (selected.size === 0) { toast.error("Selecciona al menos un servicio"); return; }
    setCreating(true);
    const servicesSnap = Array.from(selected).map((k) => {
      const meta = SERVICE_CATALOG.find((s) => s.key === k)!;
      const row = services[k];
      return {
        service_key: k,
        label: meta.label,
        one_time_price: Number(row.one_time_price),
        monthly_price: Number(row.monthly_price),
        included_text: row.included_text,
      };
    });
    const total_one_time = servicesSnap.reduce((s, x) => s + x.one_time_price, 0);
    const total_monthly = servicesSnap.reduce((s, x) => s + x.monthly_price, 0);

    const { error } = await supabase.from("client_contracts").insert({
      client_id: clientId,
      title: `Contrato — ${client.name}`,
      currency: pricing.currency,
      payment_due_days: pricing.payment_due_days,
      agency_snapshot: {
        name: "Vibranding",
        legal_name: pricing.agency_legal_name ?? "",
        tax_id: pricing.agency_tax_id ?? "",
        address: pricing.agency_address ?? "",
        email: pricing.agency_email ?? "",
        jurisdiction: pricing.jurisdiction ?? "",
      },
      client_snapshot: {
        name: client.name,
        handle: client.instagram_handle ?? "",
        legal_name: clientLegalName,
        tax_id: clientTaxId,
        address: clientAddress,
        email: clientEmail,
      },
      services_snapshot: servicesSnap,
      clauses_snapshot: buildClauses(pricing),
      total_one_time,
      total_monthly,
      effective_date: new Date().toISOString().slice(0, 10),
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contrato creado");
    setSelected(new Set());
    reloadContracts();
  };

  const deleteContract = async (id: string) => {
    if (!confirm("¿Eliminar este contrato?")) return;
    const { data, error } = await supabase.from("client_contracts").delete().eq("id", id).select("id");
    if (writeDenied(error, data)) return toast.error(NO_PERMISSION);
    reloadContracts();
  };

  const setStatus = async (id: string, status: ClientContract["status"]) => {
    const patch: any = { status };
    if (status === "signed") patch.signed_at = new Date().toISOString();
    const { data, error } = await supabase.from("client_contracts").update(patch).eq("id", id).select("id");
    if (writeDenied(error, data)) return toast.error(NO_PERMISSION);
    reloadContracts();
  };

  const downloadPdf = async (c: ClientContract) => {
    setPreviewing(c);
    await new Promise((r) => setTimeout(r, 80));
    if (!pdfRef.current) return;
    try {
      await exportElementToPdf(pdfRef.current, `contrato-${(c.client_snapshot?.name ?? "cliente").toString().toLowerCase().replace(/\s+/g, "-")}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo generar el PDF");
    } finally {
      setPreviewing(null);
    }
  };

  if (!client || !pricing || !services) return <div className="p-6 text-muted-foreground">Cargando…</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-8 space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight inline-flex items-center gap-2">
          <FileSignature className="w-7 h-7 text-muted-foreground" />
          Contratos
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Genera contratos para <span className="font-medium text-foreground">{client.name}</span> usando tu plantilla, datos de agencia y precios estándar.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Nuevo contrato</h2>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Servicios incluidos</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
            {SERVICE_CATALOG.map((s) => {
              const row = services[s.key];
              const checked = selected.has(s.key);
              return (
                <label
                  key={s.key}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                    checked ? "border-primary/50 bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggleService(s.key)} className="mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {Number(row.one_time_price) > 0 && <>Setup {pricing.currency} {Number(row.one_time_price)}</>}
                      {Number(row.one_time_price) > 0 && Number(row.monthly_price) > 0 && " · "}
                      {Number(row.monthly_price) > 0 && <>{pricing.currency} {Number(row.monthly_price)}/mes</>}
                      {Number(row.one_time_price) === 0 && Number(row.monthly_price) === 0 && "Sin precio configurado"}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Razón social del cliente" value={clientLegalName} onChange={setClientLegalName} placeholder={client.name} />
          <Field label="ID fiscal del cliente" value={clientTaxId} onChange={setClientTaxId} placeholder="NIF / CIF / RUT…" />
          <Field label="Dirección del cliente" value={clientAddress} onChange={setClientAddress} placeholder="Calle, ciudad, país" />
          <Field label="Email del cliente" value={clientEmail} onChange={setClientEmail} placeholder="cliente@email.com" type="email" />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            Plazo de pago: <strong>{pricing.payment_due_days} días</strong> · Pagos por etapa, no acumulados.
          </div>
          <Button onClick={createContract} disabled={creating || selected.size === 0}>
            <Plus className="w-4 h-4 mr-1" /> Crear contrato
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Historial</h2>
        {contracts.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Aún no hay contratos generados para este cliente.
          </div>
        ) : (
          <div className="space-y-2">
            {contracts.map((c) => (
              <div key={c.id} className="rounded-2xl border bg-card p-4 flex flex-wrap items-center gap-3">
                <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{c.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()} · {c.services_snapshot?.length ?? 0} servicios ·{" "}
                    Setup {c.currency} {Number(c.total_one_time).toFixed(0)} · {c.currency} {Number(c.total_monthly).toFixed(0)}/mes
                  </div>
                </div>
                <select
                  value={c.status}
                  onChange={(e) => setStatus(c.id, e.target.value as any)}
                  className="text-xs rounded-md border bg-background px-2 py-1"
                >
                  <option value="draft">Borrador</option>
                  <option value="sent">Enviado</option>
                  <option value="signed">Firmado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
                <Button variant="outline" size="sm" onClick={() => downloadPdf(c)}>
                  <Download className="w-4 h-4 mr-1" /> PDF
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteContract(c.id)} className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewing && (
        <div style={{ position: "fixed", left: -10000, top: 0 }}>
          <ContractDocument
            ref={pdfRef}
            title={previewing.title}
            currency={previewing.currency}
            effective_date={previewing.effective_date ?? ""}
            payment_due_days={previewing.payment_due_days}
            jurisdiction={previewing.agency_snapshot?.jurisdiction ?? ""}
            agency={{
              name: previewing.agency_snapshot?.name ?? "",
              legal_name: previewing.agency_snapshot?.legal_name ?? "",
              tax_id: previewing.agency_snapshot?.tax_id ?? "",
              address: previewing.agency_snapshot?.address ?? "",
              email: previewing.agency_snapshot?.email ?? "",
            }}
            client={{
              name: previewing.client_snapshot?.name ?? "",
              handle: previewing.client_snapshot?.handle ?? "",
              legal_name: previewing.client_snapshot?.legal_name ?? "",
              tax_id: previewing.client_snapshot?.tax_id ?? "",
              address: previewing.client_snapshot?.address ?? "",
              email: previewing.client_snapshot?.email ?? "",
            }}
            services={previewing.services_snapshot ?? []}
            clauses={previewing.clauses_snapshot ?? []}
            totals={{ one_time: Number(previewing.total_one_time), monthly: Number(previewing.total_monthly) }}
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
