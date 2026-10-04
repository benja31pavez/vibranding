import { forwardRef } from "react";
import { AGENCY_DEFAULTS, DEFAULT_CURRENCY, formatMoney, splitVat } from "@/lib/pricing/plans";

export interface ContractDocProps {
  agency: {
    name: string;
    legal_name: string;
    tax_id: string;
    address: string;
    email: string;
  };
  client: {
    name: string;
    handle: string;
    legal_name: string;
    tax_id: string;
    address: string;
    email: string;
  };
  currency: string;
  effective_date: string;
  payment_due_days: number;
  jurisdiction: string;
  /** Ley aplicable. Por defecto, las leyes de la República de Chile. */
  governingLaw?: string;
  services: Array<{
    service_key: string;
    label: string;
    one_time_price: number;
    monthly_price: number;
    included_text: string | null;
    min_months?: number | null;
  }>;
  clauses: Array<{ title: string; body: string }>;
  totals: { one_time: number; monthly: number };
  title: string;
}

const C = {
  ink: "#0f172a",
  sub: "#475569",
  muted: "#64748b",
  line: "#e2e8f0",
  brand: "#6366f1",
  bg: "#ffffff",
};

const money = (cur: string, n: number) => formatMoney(cur, n);

export const ContractDocument = forwardRef<HTMLDivElement, ContractDocProps>(function ContractDocument(
  { agency, client, currency, effective_date, payment_due_days, jurisdiction, governingLaw, services, clauses, totals, title },
  ref
) {
  const today = effective_date || new Date().toISOString().slice(0, 10);
  const law = governingLaw || AGENCY_DEFAULTS.governing_law;
  const isClp = currency.toUpperCase() === DEFAULT_CURRENCY;
  const oneTimeVat = splitVat(totals.one_time);
  const monthlyVat = splitVat(totals.monthly);
  const includesAds = services.some((s) => s.service_key === "crecimiento");
  let section = clauses.length > 0 ? 5 : 4;
  const nextSection = () => ++section;
  return (
    <div
      ref={ref}
      style={{
        width: 794, // ~A4 @96dpi
        padding: "56px 56px 80px",
        background: C.bg,
        color: C.ink,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: `2px solid ${C.brand}`, paddingBottom: 18, marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
          Contrato de prestación de servicios
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6, color: C.ink }}>{title}</div>
        <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
          Fecha de entrada en vigor: <strong>{today}</strong>
        </div>
      </div>

      {/* Parties */}
      <h2 style={h2Style}>1. Partes</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
        <PartyBlock title="Prestador" name={agency.legal_name || agency.name} taxId={agency.tax_id} address={agency.address} email={agency.email} />
        <PartyBlock title="Cliente" name={client.legal_name || client.name} taxId={client.tax_id} address={client.address} email={client.email} handle={client.handle} />
      </div>

      {/* Object */}
      <h2 style={h2Style}>2. Objeto del contrato</h2>
      <p style={{ marginBottom: 18, color: C.sub }}>
        El prestador se compromete a entregar al cliente los servicios profesionales detallados a continuación, según
        el alcance, los importes y los plazos pactados en el presente documento.
      </p>

      {/* Services table */}
      <h2 style={h2Style}>3. Servicios contratados</h2>
      {services.length === 0 ? (
        <p style={{ color: C.muted, marginBottom: 18 }}>Sin servicios seleccionados.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={thStyle}>Servicio</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Pago único</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Mensualidad</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.service_key} style={{ borderBottom: `1px solid ${C.line}` }}>
                <td style={{ ...tdStyle, width: "60%" }}>
                  <div style={{ fontWeight: 600 }}>{s.label}</div>
                  {s.included_text && (
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{s.included_text}</div>
                  )}
                  {s.min_months ? (
                    <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>
                      Permanencia mínima: {s.min_months} meses
                    </div>
                  ) : null}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                  {Number(s.one_time_price) > 0 ? money(currency, Number(s.one_time_price)) : "—"}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                  {Number(s.monthly_price) > 0 ? `${money(currency, Number(s.monthly_price))}/mes` : "—"}
                </td>
              </tr>
            ))}
            <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
              <td style={tdStyle}>Total</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{money(currency, totals.one_time)}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>{money(currency, totals.monthly)}/mes</td>
            </tr>
            {isClp && (
              <>
                <tr style={{ color: C.sub, fontSize: 12 }}>
                  <td style={tdStyle}>Neto</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(currency, oneTimeVat.net)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(currency, monthlyVat.net)}/mes</td>
                </tr>
                <tr style={{ color: C.sub, fontSize: 12 }}>
                  <td style={tdStyle}>IVA (19%)</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(currency, oneTimeVat.vat)}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{money(currency, monthlyVat.vat)}/mes</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      )}
      {isClp && services.length > 0 && (
        <p style={{ fontSize: 11.5, color: C.muted, marginBottom: 14 }}>
          Montos en pesos chilenos (CLP), IVA incluido.
          {includesAds && " La inversión en publicidad pagada (pauta en Meta Ads) no está incluida y la paga directamente el cliente."}
        </p>
      )}

      {/* Payment terms */}
      <h2 style={h2Style}>4. Condiciones de pago</h2>
      <ul style={ulStyle}>
        <li>
          Los montos <strong>no se acumulan</strong>: cada etapa se factura al momento de su entrega u ofrecimiento, y
          se paga de forma <strong>independiente</strong>. Los servicios con mensualidad se facturan cada mes durante
          su vigencia.
        </li>
        <li>
          El plazo máximo de pago es de <strong>{payment_due_days} días</strong> desde la fecha de entrega de la etapa
          correspondiente.
        </li>
        <li>
          Cada pago se respalda con factura o boleta electrónica emitida por el prestador según corresponda.
        </li>
        <li>
          Los planes mensuales tienen la permanencia mínima indicada en la tabla de servicios.
        </li>
        <li>
          Pagos vencidos podrán suspender automáticamente el servicio hasta su regularización, sin que ello exima al
          cliente del monto adeudado.
        </li>
      </ul>

      {/* Custom clauses */}
      {clauses.length > 0 && (
        <>
          <h2 style={h2Style}>5. Otras cláusulas</h2>
          {clauses.map((c, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{c.title}</div>
              <p style={{ margin: 0, color: C.sub }}>{c.body}</p>
            </div>
          ))}
        </>
      )}

      {/* Governing law */}
      <h2 style={h2Style}>{nextSection()}. Ley aplicable</h2>
      <p style={{ color: C.sub }}>
        El presente contrato se rige por <strong>{law}</strong>.
      </p>

      {/* Jurisdiction */}
      {jurisdiction && (
        <>
          <h2 style={h2Style}>{nextSection()}. Jurisdicción</h2>
          <p style={{ color: C.sub }}>
            Las partes acuerdan someter cualquier controversia derivada del presente contrato a{" "}
            <strong>{jurisdiction}</strong>.
          </p>
        </>
      )}

      {/* Signatures */}
      <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <SignatureBlock label="Por el prestador" name={agency.legal_name || agency.name} taxId={agency.tax_id} />
        <SignatureBlock label="Por el cliente" name={client.legal_name || client.name} taxId={client.tax_id} />
      </div>
    </div>
  );
});

const h2Style: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  marginTop: 22,
  marginBottom: 8,
  color: C.ink,
  borderBottom: `1px solid ${C.line}`,
  paddingBottom: 4,
};
const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: C.sub,
  padding: "8px 10px",
  borderBottom: `1px solid ${C.line}`,
};
const tdStyle: React.CSSProperties = { padding: "10px", verticalAlign: "top" };
const ulStyle: React.CSSProperties = { paddingLeft: 18, color: C.sub, marginBottom: 16 };

function PartyBlock({
  title, name, taxId, address, email, handle,
}: { title: string; name: string; taxId: string; address: string; email: string; handle?: string }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>{title}</div>
      <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{name || "—"}</div>
      {handle && <div style={{ color: C.muted, fontSize: 12 }}>@{handle}</div>}
      {taxId && <div style={{ color: C.sub, marginTop: 6, fontSize: 12 }}>RUT: {taxId}</div>}
      {address && <div style={{ color: C.sub, fontSize: 12 }}>{address}</div>}
      {email && <div style={{ color: C.sub, fontSize: 12 }}>{email}</div>}
    </div>
  );
}

function SignatureBlock({ label, name, taxId }: { label: string; name: string; taxId: string }) {
  return (
    <div>
      <div style={{ borderBottom: `1px solid ${C.ink}`, height: 60, marginBottom: 8 }} />
      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontWeight: 600, marginTop: 2 }}>{name || "—"}</div>
      {taxId && <div style={{ fontSize: 11, color: C.muted }}>{taxId}</div>}
    </div>
  );
}
