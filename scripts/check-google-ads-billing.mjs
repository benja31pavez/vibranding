#!/usr/bin/env node
/**
 * Revisa la lógica pura de Google Ads MCC + facturación
 * (src/lib/google-ads/billing.ts y src/lib/google-ads/agency.ts).
 * Uso: node scripts/check-google-ads-billing.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "gads-billing-check-"));

async function load(entry, name) {
  const outfile = join(outDir, `${name}.mjs`);
  await build({
    entryPoints: [join(root, entry)],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    alias: { "@": join(root, "src") },
    logLevel: "error",
  });
  return import(pathToFileURL(outfile).href);
}

const b = await load("src/lib/google-ads/billing.ts", "billing");
const a = await load("src/lib/google-ads/agency.ts", "agency");
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

const stream = (results) => [{ results }];
const setup = (status) => ({ status, paymentsAccountName: null });

// ── parseo
check("customer.status y moneda", () =>
  assert.deepEqual(
    b.parseCustomerInfo(
      stream([{ customer: { id: "1", status: "ENABLED", currencyCode: "CLP" } }]),
    ),
    { status: "ENABLED", currency: "CLP" },
  ),
);
check("billing_setup con nombre de cuenta de pagos", () =>
  assert.deepEqual(
    b.parseBillingSetups(
      stream([
        {
          billingSetup: {
            status: "APPROVED",
            paymentsAccountInfo: { paymentsAccountName: " Tarjeta Cliente " },
          },
        },
        { billingSetup: {} },
      ]),
    ),
    [{ status: "APPROVED", paymentsAccountName: "Tarjeta Cliente" }],
  ),
);
check("account_budget CLP en pesos", () =>
  assert.deepEqual(
    b.parseAccountBudget(
      stream([
        {
          accountBudget: {
            status: "APPROVED",
            approvedSpendingLimitMicros: "500000000000",
            amountServedMicros: "123456789000",
            approvedEndDateTime: "2026-12-31 23:59:59",
          },
        },
      ]),
      "CLP",
    ),
    { limitClp: 500000, servedClp: 123457, endAt: "2026-12-31 23:59:59" },
  ),
);
check("account_budget INFINITE = sin tope", () =>
  assert.equal(
    b.parseAccountBudget(
      stream([{ accountBudget: { status: "APPROVED", approvedSpendingLimitType: "INFINITE" } }]),
      "CLP",
    ).limitClp,
    null,
  ),
);
check("account_budget en otra moneda = null (solo CLP)", () =>
  assert.equal(
    b.parseAccountBudget(
      stream([{ accountBudget: { status: "APPROVED", approvedSpendingLimitMicros: "1" } }]),
      "USD",
    ),
    null,
  ),
);
check("sin account_budget = null", () => assert.equal(b.parseAccountBudget([], "CLP"), null));

// ── mapeo de estados
check("gana el mejor billing_setup", () =>
  assert.equal(b.pickBillingStatus([setup("CANCELLED"), setup("APPROVED")]), "APPROVED"),
);
check("sin billing_setup = NONE", () => assert.equal(b.pickBillingStatus([]), "NONE"));

const ev = (customerStatus, setups, linked = true) =>
  b.evaluateBilling({ linked, customerStatus, setups });
check("APPROVED → verificado y válido", () => {
  const r = ev("ENABLED", [setup("APPROVED")]);
  assert.equal(r.verdict, "verificado");
  assert.equal(r.hasValidBilling, true);
});
check("PENDING → pendiente", () => {
  const r = ev("ENABLED", [setup("PENDING")]);
  assert.equal(r.verdict, "pendiente");
  assert.equal(r.hasValidBilling, false);
});
check("APPROVED_HELD → pendiente (no válido)", () =>
  assert.equal(ev("ENABLED", [setup("APPROVED_HELD")]).hasValidBilling, false),
);
check("CANCELLED → rechazado", () =>
  assert.equal(ev("ENABLED", [setup("CANCELLED")]).verdict, "rechazado"),
);
check("sin medio de pago → pendiente", () => assert.equal(ev("ENABLED", []).verdict, "pendiente"));
check("cuenta suspendida → rechazado aunque haya tarjeta", () => {
  const r = ev("SUSPENDED", [setup("APPROVED")]);
  assert.equal(r.verdict, "rechazado");
  assert.equal(r.hasValidBilling, false);
  assert.equal(r.customerBlocked, true);
});
check("sin cuenta vinculada → sin_cuenta", () =>
  assert.equal(ev(null, [], false).verdict, "sin_cuenta"),
);
check("estado desconocido falla cerrado", () =>
  assert.equal(ev("ENABLED", [setup("RARO")]).hasValidBilling, false),
);

// ── gate
const NOW = new Date("2026-10-20T12:00:00Z");
const CID = "1234567890";
const OK_ROW = {
  has_valid_billing: true,
  last_success_at: "2026-10-20T07:00:00Z",
  customer_id: CID,
};
check("gate: resultado de otra cuenta bloquea", () =>
  assert.notEqual(b.billingGateError(OK_ROW, "9999999999", NOW), null),
);
check("gate: cliente sin cuenta vinculada bloquea", () =>
  assert.notEqual(b.billingGateError(OK_ROW, null, NOW), null),
);
check("gate: sin fila bloquea", () =>
  assert.equal(b.billingGateError(null, "1234567890", NOW), b.BILLING_NOT_VERIFIED_MESSAGE),
);
check("gate: mensaje exacto en español", () =>
  assert.equal(
    b.BILLING_NOT_VERIFIED_MESSAGE,
    "El cliente aún no tiene un medio de pago verificado en Google Ads",
  ),
);
check("gate: pago no válido bloquea", () =>
  assert.notEqual(
    b.billingGateError(
      { has_valid_billing: false, last_success_at: "2026-10-20T07:00:00Z", customer_id: CID },
      CID,
      NOW,
    ),
    null,
  ),
);
check("gate: válido y reciente permite", () =>
  assert.equal(
    b.billingGateError(
      { has_valid_billing: true, last_success_at: "2026-10-20T07:00:00Z", customer_id: CID },
      CID,
      NOW,
    ),
    null,
  ),
);
check("gate: chequeo viejo (>72 h) bloquea", () =>
  assert.notEqual(
    b.billingGateError(
      { has_valid_billing: true, last_success_at: "2026-10-16T07:00:00Z", customer_id: CID },
      CID,
      NOW,
    ),
    null,
  ),
);
check("gate: fecha inválida bloquea", () =>
  assert.notEqual(
    b.billingGateError(
      { has_valid_billing: true, last_success_at: "x", customer_id: CID },
      CID,
      NOW,
    ),
    null,
  ),
);

// ── alertas y mensaje
check("alerta: verificado no alerta", () =>
  assert.equal(b.billingAlert({ verdict: "verificado", customerBlocked: false }, "Ana"), null),
);
check("alerta: sin cuenta no alerta", () =>
  assert.equal(b.billingAlert({ verdict: "sin_cuenta", customerBlocked: false }, "Ana"), null),
);
check("alerta: pendiente = warning con texto de Inicio", () => {
  const r = b.billingAlert({ verdict: "pendiente", customerBlocked: false }, "Proyecta");
  assert.equal(r.severity, "warning");
  assert.equal(r.message, "Pago de pauta: revisar Google Ads de Proyecta");
  assert.equal(r.kind, "billing_google");
  assert.equal(r.dedupeKey, "billing_google");
});
check("alerta: suspendida = critical", () =>
  assert.equal(
    b.billingAlert({ verdict: "rechazado", customerBlocked: true }, "X").severity,
    "critical",
  ),
);
check("mensaje al cliente: saludo, link y firma", () => {
  const m = b.buildCardUpdateMessage({
    clientName: "Proyecta",
    contactName: "Juan",
    verdict: "rechazado",
  });
  assert.match(m.body, /^Hola Juan/);
  assert.match(m.body, /rechazado/);
  assert.ok(m.body.includes(b.GOOGLE_ADS_BILLING_URL));
  assert.match(m.body, /Equipo Vibranding$/);
  assert.match(m.subject, /Proyecta/);
});
check("etiquetas de chip", () =>
  assert.deepEqual(Object.values(b.BILLING_VERDICT_LABEL), [
    "Verificado",
    "Pendiente",
    "Rechazado",
    "Sin cuenta",
  ]),
);

// ── agencia (MCC)
check("MCC detectada", () =>
  assert.deepEqual(
    a.parseManagerCandidate(
      stream([
        { customer: { id: "1234567890", manager: true, descriptiveName: "Vibranding MCC" } },
      ]),
    ),
    { customerId: "1234567890", name: "Vibranding MCC" },
  ),
);
check("cuenta normal no es MCC", () =>
  assert.equal(
    a.parseManagerCandidate(stream([{ customer: { id: "1234567890", manager: false } }])),
    null,
  ),
);
const m1 = { customerId: "1111111111", name: "A" };
const m2 = { customerId: "2222222222", name: "B" };
check("una sola MCC se elige sola", () => assert.equal(a.chooseAgencyManager([m1], [null]), m1));
check("se conserva la MCC guardada antes que la del entorno", () =>
  assert.equal(a.chooseAgencyManager([m1, m2], ["2222222222", "1111111111"]), m2),
);
check("MCC guardada que ya no está: pasa a la siguiente preferida", () =>
  assert.equal(a.chooseAgencyManager([m1, m2], ["9999999999", "1111111111"]), m1),
);
check("varias MCC: gana la preferida", () =>
  assert.equal(a.chooseAgencyManager([m1, m2], [null, "2222222222"]), m2),
);
check("varias MCC sin preferida: elegir", () =>
  assert.equal(a.chooseAgencyManager([m1, m2], [null, null]), null),
);
check("sin MCC: none", () => assert.equal(a.chooseAgencyManager([], []), "none"));

const agency = { status: "conectada", manager_customer_id: "1111111111", token_secret_id: "s" };
check("token propio del cliente sigue funcionando", () =>
  assert.deepEqual(
    a.resolveAuthPlan(
      { auth_source: "cliente", token_secret_id: "t", manager_customer_id: "3333333333" },
      agency,
    ),
    { source: "cliente", loginCustomerId: "3333333333" },
  ),
);
check("cuenta de agencia usa la MCC como login-customer-id", () =>
  assert.deepEqual(
    a.resolveAuthPlan(
      { auth_source: "agencia", token_secret_id: null, manager_customer_id: null },
      agency,
    ),
    { source: "agencia", loginCustomerId: "1111111111" },
  ),
);
check("cuenta de agencia sin conexión de agencia → reconectar", () => {
  const r = a.resolveAuthPlan(
    { auth_source: "agencia", token_secret_id: null, manager_customer_id: null },
    { ...agency, status: "error" },
  );
  assert.equal(r.needsReconnect, true);
});
check("cuenta propia sin token → reconectar", () =>
  assert.equal(
    a.resolveAuthPlan(
      { auth_source: "cliente", token_secret_id: null, manager_customer_id: null },
      agency,
    ).needsReconnect,
    true,
  ),
);

if (failures.length > 0) {
  console.error(`check-google-ads-billing: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-google-ads-billing: OK");
