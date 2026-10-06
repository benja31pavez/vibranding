import { useEffect, useRef, useState } from "react";
import { chileToday } from "@/lib/dates/chile";
import { ErrorState, ListSkeleton } from "@/components/app";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  loadPricing,
  loadServicePricing,
  SERVICE_CATALOG,
  type PricingSettings,
  type ServicePricing,
  type ServiceKey,
} from "@/components/PricingPanel";
import { ContractDocument } from "@/components/contracts/ContractDocument";
import { NewContractForm } from "@/components/contracts/NewContractForm";
import { ContractHistory } from "@/components/contracts/ContractHistory";
import {
  addonHasPrice,
  contractLineFromNet,
  EMPTY_LEGAL_DATA,
  NET_PLUS_IVA_BASIS,
  type ClientContract,
  type ClientLegalData,
} from "@/components/contracts/contractModel";
import { exportElementToPdf } from "@/lib/exportPdf";
import { AGENCY_DEFAULTS, DEFAULT_CURRENCY, findPlan, type PlanKey } from "@/lib/pricing/plans";

/** RLS hides rows instead of erroring: 0 affected rows means "not allowed". */
const NO_PERMISSION = "No tienes permisos para esta acción";
function writeDenied(error: unknown, rows: unknown[] | null): boolean {
  return Boolean(error) || !rows || rows.length === 0;
}

/**
 * Datos legales de la ficha de onboarding (client_intake), para precargar el contrato.
 * Es opcional: si falla la lectura se avisa en consola y el formulario queda vacío.
 */
async function loadIntakeLegalData(clientId: string): Promise<Partial<ClientLegalData>> {
  const { data, error } = await supabase
    .from("client_intake")
    .select("razon_social,rut,direccion,email_facturacion,contacto_email")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    console.warn("[contratos] no se pudo leer la ficha de onboarding", clientId, error.message);
    return {};
  }
  if (!data) return {};
  return {
    legalName: data.razon_social?.trim() ?? "",
    taxId: data.rut?.trim() ?? "",
    address: data.direccion?.trim() ?? "",
    email: data.email_facturacion?.trim() || data.contacto_email?.trim() || "",
  };
}

/** Completa solo los campos que el usuario aún no escribió. */
function fillEmpty(prev: ClientLegalData, prefill: Partial<ClientLegalData>): ClientLegalData {
  return {
    legalName: prev.legalName || prefill.legalName || "",
    taxId: prev.taxId || prefill.taxId || "",
    address: prev.address || prefill.address || "",
    email: prev.email || prefill.email || "",
  };
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
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  const [creating, setCreating] = useState(false);
  const [legal, setLegal] = useState<ClientLegalData>(EMPTY_LEGAL_DATA);
  const [previewing, setPreviewing] = useState<ClientContract | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);

  /** Carga cliente, precios, servicios y contratos; si algo falla, se muestra con reintentar. */
  /** Cliente para el que se pidió la última carga; descarta respuestas de un cliente anterior. */
  const requestedClientRef = useRef(clientId);

  const loadAll = async () => {
    if (!user) return;
    const forClient = clientId;
    requestedClientRef.current = forClient;
    const isStale = () => requestedClientRef.current !== forClient;
    setLoadingAll(true);
    setLoadError(null);
    try {
      const [clientRes, p, sv, intake] = await Promise.all([
        supabase
          .from("clients")
          .select("id,name,instagram_handle,notes,business_description")
          .eq("id", clientId)
          .maybeSingle(),
        loadPricing(user.id),
        loadServicePricing(user.id),
        loadIntakeLegalData(clientId),
      ]);
      if (isStale()) return;
      if (clientRes.error) throw new Error(clientRes.error.message);
      if (!clientRes.data) throw new Error("No se encontró el cliente o no tienes acceso.");
      setClient(clientRes.data as ClientRow);
      setPricing(p);
      setServices(sv);
      setLegal((prev) => fillEmpty(prev, intake));
      await reloadContracts();
    } catch (e: any) {
      if (!isStale()) setLoadError(e?.message ?? "No se pudo cargar la información de contratos");
    } finally {
      if (!isStale()) setLoadingAll(false);
    }
  };

  /** Al cambiar de cliente no se arrastran datos ni selecciones del anterior. */
  const resetClientState = () => {
    setClient(null);
    setContracts([]);
    setSelected(new Set());
    setSelectedPlan(null);
    setLegal(EMPTY_LEGAL_DATA);
    setPreviewing(null);
    setLoadError(null);
  };

  useEffect(() => {
    resetClientState();
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, clientId]);

  const reloadContracts = async () => {
    const forClient = clientId;
    const { data, error } = await supabase
      .from("client_contracts")
      .select("*")
      .eq("client_id", forClient)
      .order("created_at", { ascending: false });
    if (requestedClientRef.current !== forClient) return;
    if (error) throw new Error(`No se pudieron cargar los contratos: ${error.message}`);
    setContracts((data ?? []) as any);
  };

  const toggleService = (k: ServiceKey) => {
    // Un adicional sin precio no se puede sumar: se configura primero en Precios.
    if (!selected.has(k) && !addonHasPrice(services?.[k])) return;
    const s = new Set(selected);
    if (s.has(k)) s.delete(k);
    else s.add(k);
    setSelected(s);
  };

  const buildClauses = (p: PricingSettings) => {
    const list: { title: string; body: string }[] = [];
    if (p.clause_esim) list.push({ title: "eSIM / teléfono dedicado", body: p.clause_esim });
    if (p.clause_meta_api)
      list.push({ title: "Uso responsable Meta API / WhatsApp", body: p.clause_meta_api });
    if (p.clause_late_payment)
      list.push({ title: "Mora / suspensión por impago", body: p.clause_late_payment });
    if (p.clause_extra) list.push({ title: "Cláusulas adicionales", body: p.clause_extra });
    return list;
  };

  const createContract = async () => {
    if (!pricing || !services || !client) return;
    if (selected.size === 0 && !selectedPlan) {
      toast.error("Selecciona un plan o al menos un servicio");
      return;
    }
    const plan = findPlan(selectedPlan);
    setCreating(true);
    const planSnap = plan
      ? [
          {
            service_key: plan.key,
            label: plan.label,
            one_time_price: plan.billing === "one_time" ? plan.netPrice : 0,
            monthly_price: plan.billing === "monthly" ? plan.netPrice : 0,
            included_text: [plan.description, plan.note].filter(Boolean).join(" "),
            min_months: null,
          },
        ]
      : [];
    const addonSnap = Array.from(selected).map((k) => {
      const meta = SERVICE_CATALOG.find((s) => s.key === k)!;
      const row = services[k];
      return {
        service_key: k,
        label: meta.label,
        one_time_price: Number(row.one_time_price),
        monthly_price: Number(row.monthly_price),
        included_text: row.included_text,
        min_months: null,
      };
    });
    // Precios de lista netos → cada línea guarda el total con IVA (lo que se cobra).
    const servicesSnap = [...planSnap, ...addonSnap].map(contractLineFromNet);
    const total_one_time = servicesSnap.reduce((s, x) => s + x.one_time_price, 0);
    const total_monthly = servicesSnap.reduce((s, x) => s + x.monthly_price, 0);

    const { error } = await supabase.from("client_contracts").insert({
      client_id: clientId,
      title: `Contrato — ${client.name}`,
      currency: DEFAULT_CURRENCY,
      payment_due_days: pricing.payment_due_days,
      agency_snapshot: {
        name: AGENCY_DEFAULTS.name,
        legal_name: pricing.agency_legal_name || AGENCY_DEFAULTS.legal_name,
        tax_id: pricing.agency_tax_id || AGENCY_DEFAULTS.tax_id,
        address: pricing.agency_address || AGENCY_DEFAULTS.address,
        email: pricing.agency_email || AGENCY_DEFAULTS.email,
        jurisdiction: pricing.jurisdiction || AGENCY_DEFAULTS.jurisdiction,
        governing_law: AGENCY_DEFAULTS.governing_law,
        vat_included: true,
        price_basis: NET_PLUS_IVA_BASIS,
      },
      client_snapshot: {
        name: client.name,
        handle: client.instagram_handle ?? "",
        legal_name: legal.legalName,
        tax_id: legal.taxId,
        address: legal.address,
        email: legal.email,
      },
      services_snapshot: servicesSnap,
      clauses_snapshot: buildClauses(pricing),
      total_one_time,
      total_monthly,
      effective_date: chileToday(),
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contrato creado");
    setSelected(new Set());
    setSelectedPlan(null);
    void reloadContracts().catch((e) => toast.error(e.message));
  };

  const deleteContract = async (id: string) => {
    if (!confirm("¿Eliminar este contrato?")) return;
    const { data, error } = await supabase
      .from("client_contracts")
      .delete()
      .eq("id", id)
      .select("id");
    if (writeDenied(error, data)) return toast.error(NO_PERMISSION);
    void reloadContracts().catch((e) => toast.error(e.message));
  };

  const setStatus = async (id: string, status: ClientContract["status"]) => {
    const patch: any = { status };
    if (status === "signed") patch.signed_at = new Date().toISOString();
    const { data, error } = await supabase
      .from("client_contracts")
      .update(patch)
      .eq("id", id)
      .select("id");
    if (writeDenied(error, data)) return toast.error(NO_PERMISSION);
    void reloadContracts().catch((e) => toast.error(e.message));
  };

  const downloadPdf = async (c: ClientContract) => {
    setPreviewing(c);
    await new Promise((r) => setTimeout(r, 80));
    if (!pdfRef.current) {
      setPreviewing(null);
      toast.error("No se pudo preparar el contrato para el PDF");
      return;
    }
    try {
      await exportElementToPdf(
        pdfRef.current,
        `contrato-${(c.client_snapshot?.name ?? "cliente").toString().toLowerCase().replace(/\s+/g, "-")}.pdf`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo generar el PDF");
    } finally {
      setPreviewing(null);
    }
  };

  if (loadError) {
    return (
      <ErrorState
        title="No pudimos cargar los contratos"
        message={loadError}
        onRetry={() => void loadAll()}
        retrying={loadingAll}
      />
    );
  }
  if (!client || !pricing || !services) return <ListSkeleton rows={4} label="Cargando contratos" />;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
      <NewContractForm
        clientName={client.name}
        services={services}
        selectedPlan={selectedPlan}
        onSelectPlan={setSelectedPlan}
        selectedAddons={selected}
        onToggleAddon={toggleService}
        legal={legal}
        onLegalChange={(field, value) => setLegal((prev) => ({ ...prev, [field]: value }))}
        paymentDueDays={pricing.payment_due_days}
        creating={creating}
        onCreate={() => void createContract()}
      />
      {/* En escritorio el historial no estira la fila: ocupa el alto del formulario y hace scroll. */}
      <div className="relative min-h-64">
        <ContractHistory
          contracts={contracts}
          onSetStatus={(id, status) => void setStatus(id, status)}
          onDownload={(c) => void downloadPdf(c)}
          onDelete={(id) => void deleteContract(id)}
          className="h-full lg:absolute lg:inset-0"
        />
      </div>

      {previewing && (
        <div style={{ position: "fixed", left: -10000, top: 0 }}>
          <ContractDocument
            ref={pdfRef}
            title={previewing.title}
            effective_date={previewing.effective_date ?? ""}
            payment_due_days={previewing.payment_due_days}
            jurisdiction={previewing.agency_snapshot?.jurisdiction ?? ""}
            governingLaw={previewing.agency_snapshot?.governing_law ?? ""}
            vatIncluded={previewing.agency_snapshot?.vat_included === true}
            netPlusIva={previewing.agency_snapshot?.price_basis === NET_PLUS_IVA_BASIS}
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
            totals={{
              one_time: Number(previewing.total_one_time),
              monthly: Number(previewing.total_monthly),
            }}
          />
        </div>
      )}
    </div>
  );
}
