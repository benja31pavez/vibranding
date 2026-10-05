#!/usr/bin/env node
/**
 * Revisa la lógica pura del pago de pauta (src/lib/ads-billing/*) y el paso
 * Publicidad del onboarding (payload, tolerancia a BD sin migración).
 * Uso: node scripts/check-ads-billing.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "ads-billing-check-"));
const entry = join(outDir, "entry.ts");
const outFile = join(outDir, "bundle.mjs");
writeFileSync(
  entry,
  [
    `export * as status from ${JSON.stringify(join(root, "src/lib/ads-billing/metaStatus.ts"))};`,
    `export * as combined from ${JSON.stringify(join(root, "src/lib/ads-billing/combined.ts"))};`,
    `export * as alert from ${JSON.stringify(join(root, "src/lib/ads-billing/alert.ts"))};`,
    `export * as messages from ${JSON.stringify(join(root, "src/lib/ads-billing/messages.ts"))};`,
    `export * as guides from ${JSON.stringify(join(root, "src/lib/ads-billing/guides.ts"))};`,
    `export * as schema from ${JSON.stringify(join(root, "src/lib/onboarding/schema.ts"))};`,
    `export * as form from ${JSON.stringify(join(root, "src/components/onboarding/formState.ts"))};`,
  ].join("\n"),
);

await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  alias: { "@": join(root, "src") },
  logLevel: "error",
});
const { status, combined, alert, messages, guides, schema, form } = await import(
  pathToFileURL(outFile).href
);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function test(name, fn) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`FAIL ${name}\n     ${e.message}`);
  }
}

// ---------------------------------------------------------------- estado Meta
const ev = (account_status, has_funding = true) =>
  status.evaluateMetaBilling({ account_status, has_funding });

test("1 ACTIVE con tarjeta → verificado, sin alerta", () => {
  const r = ev(1);
  assert.equal(r.reason, "ok");
  assert.equal(r.verified, true);
  assert.equal(r.alert, null);
});
test("1 ACTIVE sin funding → Sin medio de pago (alerta warning)", () => {
  const r = ev(1, false);
  assert.equal(r.reason, "no_funding");
  assert.equal(r.verified, false);
  assert.equal(r.alert, "warning");
  assert.equal(r.label, "Sin medio de pago");
});
test("1 ACTIVE sin permiso para ver funding → no verificado, sin alerta", () => {
  const r = ev(1, null);
  assert.equal(r.reason, "funding_unknown");
  assert.equal(r.verified, false);
  assert.equal(r.alert, null);
});
test("2 DISABLED y 3 UNSETTLED → crítica", () => {
  assert.equal(ev(2).reason, "disabled");
  assert.equal(ev(2).alert, "critical");
  assert.equal(ev(3).reason, "unsettled");
  assert.equal(ev(3).alert, "critical");
  assert.equal(ev(3).verified, false);
});
test("7/8/9 → problema sin alerta, no verificado", () => {
  for (const [code, reason] of [
    [7, "pending_review"],
    [8, "pending_settlement"],
    [9, "grace_period"],
  ]) {
    const r = ev(code);
    assert.equal(r.reason, reason);
    assert.equal(r.verified, false);
    assert.equal(r.alert, null);
  }
});
test("101 / desconocido → no verificado", () => {
  assert.equal(ev(101).reason, "closed");
  assert.equal(ev(null).reason, "unknown_status");
  assert.equal(ev(42).verified, false);
});
test("hasFundingSource", () => {
  assert.equal(status.hasFundingSource(undefined), false);
  assert.equal(status.hasFundingSource(null), false);
  assert.equal(status.hasFundingSource({}), false);
  assert.equal(status.hasFundingSource([]), false);
  assert.equal(status.hasFundingSource({ id: "123", type: 1 }), true);
  assert.equal(status.hasFundingSource({ display_string: "Visa *1234" }), true);
});
test("normalizeAdAccountId / toAmount / billing hub", () => {
  assert.equal(status.normalizeAdAccountId("act_123"), "123");
  assert.equal(status.normalizeAdAccountId(" 456 "), "456");
  assert.equal(status.normalizeAdAccountId("act_12x"), null);
  assert.equal(status.normalizeAdAccountId(null), null);
  assert.equal(status.toAmount("1500"), 1500);
  assert.equal(status.toAmount(""), null);
  assert.equal(status.toAmount("abc"), null);
  assert.match(status.metaBillingHubUrl("act_99"), /billing_hub\/accounts\/details\?asset_id=99$/);
  assert.equal(status.metaBillingHubUrl("x"), "https://business.facebook.com/billing_hub");
});
test("mensaje de bloqueo en español", () => {
  assert.match(status.metaActivationBlockedMessage("no_funding"), /^No se puede activar/);
  assert.match(status.metaActivationBlockedMessage("unsettled"), /saldo impago/);
  assert.match(status.metaActivationBlockedMessage("pending_review"), /revisión/);
});

// ---------------------------------------------------------------- estado combinado
const c = combined.combineAdsBillingState;
test("combinado: verificación manda sobre lo declarado", () => {
  assert.equal(c({ selfReportedAt: null, linked: true, verification: "verified" }), "verificado");
  assert.equal(
    c({ selfReportedAt: "2026-10-01T00:00:00Z", linked: true, verification: "rejected" }),
    "rechazado",
  );
  assert.equal(
    c({ selfReportedAt: "2026-10-01T00:00:00Z", linked: false, verification: null }),
    "pendiente",
  );
  assert.equal(c({ selfReportedAt: null, linked: true, verification: null }), "pendiente");
  assert.equal(c({ selfReportedAt: null, linked: false, verification: null }), "sin_cuenta");
});
test("metaVerification", () => {
  assert.equal(combined.metaVerification(null), null);
  assert.equal(combined.metaVerification({ account_status: 1, has_funding: true }), "verified");
  assert.equal(combined.metaVerification({ account_status: 1, has_funding: null }), null);
  assert.equal(combined.metaVerification({ account_status: 1, has_funding: false }), "rejected");
  assert.equal(combined.metaVerification({ account_status: 3, has_funding: true }), "rejected");
});
test("googleVerification: columnas reales de google_ads_billing_status", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const fresh = "2026-10-04T12:00:00Z";
  const stale = "2026-10-01T11:00:00Z";
  const g = (row) => combined.googleVerification(row, now);
  assert.equal(g(null), null);
  assert.equal(
    g({ verdict: "rechazado", has_valid_billing: true, last_success_at: fresh }),
    "rejected",
  );
  assert.equal(
    g({ verdict: "verificado", has_valid_billing: true, last_success_at: fresh }),
    "verified",
  );
  assert.equal(
    g({ verdict: "verificado", has_valid_billing: false, last_success_at: fresh }),
    null,
  );
  assert.equal(g({ verdict: "verificado", has_valid_billing: true, last_success_at: stale }), null);
  assert.equal(g({ verdict: "verificado", has_valid_billing: true, last_success_at: null }), null);
  assert.equal(g({ verdict: "pendiente", has_valid_billing: true, last_success_at: fresh }), null);
  assert.equal(g({ verdict: "sin_cuenta" }), null);
  assert.equal(
    g({ verdict: "verificado", has_valid_billing: true, last_success_at: "2026-10-06T00:00:00Z" }),
    null,
  );
});
test("parseSelfReported / parsePlatforms", () => {
  assert.deepEqual(combined.parseSelfReported(undefined), { google: null, meta: null });
  assert.deepEqual(
    combined.parseSelfReported({ google: "2026-10-01T10:00:00+00:00", meta: null, x: 1 }),
    { google: "2026-10-01T10:00:00+00:00", meta: null },
  );
  assert.deepEqual(combined.parseSelfReported({ meta: true }), { google: null, meta: null });
  assert.equal(combined.parsePlatforms(undefined), null);
  assert.deepEqual(combined.parsePlatforms([]), []);
  assert.deepEqual(combined.parsePlatforms(["meta", "tiktok"]), ["meta"]);
});
test("adsBillingRows: Meta verificada + Google declarado", () => {
  const rows = combined.adsBillingRows({
    intake: {
      ads_platforms: ["google", "meta"],
      ads_billing_self_reported: { google: "2026-10-01T10:00:00Z", meta: null },
    },
    metaAdAccountId: "123",
    metaStatus: { account_status: 1, has_funding: true },
    googleCustomerId: null,
    googleStatus: null,
  });
  const by = Object.fromEntries(rows.map((r) => [r.platform, r]));
  assert.equal(by.meta.state, "verificado");
  assert.equal(by.google.state, "pendiente");
  assert.equal(by.google.chosen, true);
});
test("adsBillingRows: Google sin cuenta enlazada ignora la verificación", () => {
  const rows = combined.adsBillingRows(
    {
      intake: null,
      metaAdAccountId: null,
      metaStatus: null,
      googleCustomerId: null,
      googleStatus: { verdict: "rechazado" },
    },
    new Date("2026-10-05T12:00:00Z"),
  );
  assert.equal(rows.find((r) => r.platform === "google").state, "sin_cuenta");
});
test("adsBillingRows: sin intake ni cuentas → Sin cuenta", () => {
  const rows = combined.adsBillingRows({
    intake: null,
    metaAdAccountId: null,
    metaStatus: { account_status: 3, has_funding: false },
    googleCustomerId: null,
    googleStatus: null,
  });
  assert.deepEqual(
    rows.map((r) => r.state),
    ["sin_cuenta", "sin_cuenta"],
  );
  assert.equal(rows[0].chosen, null);
});

// ---------------------------------------------------------------- alerta y mensaje
test("alerta billing_meta solo para impago / deshabilitada / sin tarjeta", () => {
  assert.equal(alert.metaBillingAlertCandidate("Café Lalo", "123", ev(1)), null);
  assert.equal(alert.metaBillingAlertCandidate("Café Lalo", "123", ev(7)), null);
  const a = alert.metaBillingAlertCandidate("Café Lalo", "123", ev(3));
  assert.equal(a.kind, "billing_meta");
  assert.equal(a.severity, "critical");
  assert.equal(a.dedupeKey, "billing_meta:123");
  assert.match(a.message, /^Pago de pauta: revisar Meta Ads de Café Lalo/);
  assert.equal(alert.metaBillingAlertCandidate("X", "1", ev(1, false)).severity, "warning");
});
test("staleBillingAlertIds: cierra alertas de cuentas que ya no son la del cliente", () => {
  const open = [
    { id: "a", client_id: "c1", dedupe_key: "billing_meta:111" },
    { id: "b", client_id: "c1", dedupe_key: "billing_meta:222" },
    { id: "c", client_id: "c2", dedupe_key: "billing_meta:333" },
    { id: "d", client_id: "c3", dedupe_key: "billing_meta:444" },
  ];
  const current = new Map([
    ["c1", "111"],
    ["c2", null],
  ]);
  assert.deepEqual(alert.staleBillingAlertIds(open, current), ["b", "c", "d"]);
  assert.deepEqual(alert.staleBillingAlertIds([], current), []);
});
test("parseBillingAlertData reconstruye el link y tolera datos raros", () => {
  const d = alert.parseBillingAlertData({
    reason: "unsettled",
    ad_account_id: "55",
    client_name: "Café",
    billing_url: "https://evil.example",
  });
  assert.equal(d.reason, "unsettled");
  assert.match(d.billingUrl, /^https:\/\/business\.facebook\.com\/billing_hub/);
  assert.equal(alert.parseBillingAlertData(null).reason, "no_funding");
  assert.equal(alert.parseBillingAlertData({ reason: "hack" }).reason, "no_funding");
});
test("mensaje al cliente: tarjeta propia, sin cobro de pauta de Vibranding", () => {
  const m = messages.buildAdsBillingMessage({
    clientName: "Café Lalo",
    contactName: "Lalo",
    reason: "unsettled",
    adAccountId: "act_77",
  });
  assert.match(m.subject, /Café Lalo/);
  assert.match(m.body, /^Hola Lalo/);
  assert.match(m.body, /saldo pendiente/);
  assert.match(m.body, /asset_id=77/);
  assert.match(m.body, /Vibranding nunca cobra la pauta/);
  assert.match(
    messages.buildAdsBillingMessage({ clientName: "X", reason: "closed" }).body,
    /^Hola, te escribo/,
  );
});

// ---------------------------------------------------------------- onboarding
test("platformsForChoice", () => {
  assert.equal(guides.platformsForChoice(""), null);
  assert.deepEqual(guides.platformsForChoice("ninguno"), []);
  assert.deepEqual(guides.platformsForChoice("ambos"), ["google", "meta"]);
  assert.deepEqual(guides.platformsForChoice("meta"), ["meta"]);
});
test("guías: pasos numerables y links oficiales", () => {
  for (const g of Object.values(guides.ADS_GUIDES)) {
    assert.ok(g.steps.length >= 3 && g.steps.length <= 6, g.title);
    assert.match(g.link.href, /^https:\/\/(ads\.google\.com|business\.facebook\.com)\//);
  }
  assert.match(guides.ADS_GUIDES.meta.link.href, /billing_hub/);
});

const baseState = () => ({ ...form.initialState(), razon_social: "Café Lalo SpA" });
const payloadOf = (state) => {
  const parsed = schema.OnboardingForm.parse(form.toFormData(state));
  return schema.buildPayload(parsed);
};
test("payload: sin responder no envía claves de publicidad", () => {
  const p = payloadOf(baseState());
  assert.equal("ads_platforms" in p, false);
  assert.equal("ads_billing_self_reported" in p, false);
});
test("payload: ninguno → ads_platforms vacío, sin casillas", () => {
  const p = payloadOf({
    ...baseState(),
    ads_choice: "ninguno",
    ads_card: { google: true, meta: true },
  });
  assert.deepEqual(p.ads_platforms, []);
  assert.equal("ads_billing_self_reported" in p, false);
});
test("payload: ambos con tarjeta en Meta", () => {
  const p = payloadOf({
    ...baseState(),
    ads_choice: "ambos",
    ads_card: { google: false, meta: true },
  });
  assert.deepEqual(p.ads_platforms, ["google", "meta"]);
  assert.deepEqual(p.ads_billing_self_reported, { google: false, meta: true });
  assert.ok(schema.PayloadSchema.safeParse(p).success, "PayloadSchema acepta el paso Publicidad");
});
test("payload: solo Google ignora la casilla de Meta", () => {
  const p = payloadOf({
    ...baseState(),
    ads_choice: "google",
    ads_card: { google: true, meta: true },
  });
  assert.deepEqual(p.ads_billing_self_reported, { google: true });
});
test("PayloadSchema rechaza plataformas o claves inventadas", () => {
  const base = { razon_social: "X" };
  assert.equal(
    schema.PayloadSchema.safeParse({ ...base, ads_platforms: ["tiktok"] }).success,
    false,
  );
  assert.equal(
    schema.PayloadSchema.safeParse({ ...base, ads_platforms: ["meta", "meta"] }).success,
    false,
  );
  assert.equal(
    schema.PayloadSchema.safeParse({ ...base, ads_billing_self_reported: { meta: "sí" } }).success,
    false,
  );
  assert.equal(
    schema.PayloadSchema.safeParse({ ...base, ads_billing_self_reported: { tarjeta: true } })
      .success,
    false,
  );
});
test("tolerancia: BD sin migración → reenvío sin claves de publicidad", () => {
  assert.equal(schema.isAdsFieldUnsupported("campo ads_platforms no permitido"), true);
  assert.equal(schema.isAdsFieldUnsupported("campo ads_billing_self_reported no permitido"), true);
  assert.equal(schema.isAdsFieldUnsupported("campo rut inválido"), false);
  assert.equal(schema.isAdsFieldUnsupported(null), false);
  const p = {
    razon_social: "X",
    ads_platforms: ["meta"],
    ads_billing_self_reported: { meta: true },
  };
  assert.deepEqual(schema.withoutAdsFields(p), { razon_social: "X" });
});
test("errores de la BD del paso Publicidad llevan al paso correcto", () => {
  const e = schema.mapDbError("campo ads_platforms inválido");
  assert.equal(e.field, "ads_platforms");
  assert.equal(
    schema.FIELD_STEP[e.field],
    form.STEPS.findIndex((s) => s.short === "Publicidad"),
  );
  assert.equal(schema.FIELD_STEP.archivos, form.STEPS.length - 1);
});

if (failures.length) {
  console.error(`\ncheck-ads-billing: ${failures.length} fallo(s)`);
  process.exit(1);
}
console.log("\ncheck-ads-billing: OK");
