#!/usr/bin/env node
/**
 * Revisa "Pedir reseña" (src/lib/reviews/requestReview.ts y la sugerencia
 * "pedir_resena" de src/lib/followups/reviewSuggestions.ts).
 * Uso: node scripts/check-reviews.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "reviews-check-"));
const entry = join(outDir, "entry.ts");
const outFile = join(outDir, "reviews.mjs");
writeFileSync(
  entry,
  [
    `export * from ${JSON.stringify(join(root, "src/lib/reviews/requestReview.ts"))};`,
    `export { reviewFollowups } from ${JSON.stringify(join(root, "src/lib/followups/reviewSuggestions.ts"))};`,
    `export { buildMessage } from ${JSON.stringify(join(root, "src/lib/followups/templates.ts"))};`,
    `export { GOOGLE_REVIEW_URL } from ${JSON.stringify(join(root, "src/lib/site.ts"))};`,
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

const r = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

const TODAY = "2026-10-20";
const GOOGLE = "https://g.page/r/abc123/review";
// Política de Google: nada a cambio de una reseña. Tampoco urgencia falsa.
const INCENTIVE = /descuento|regalo|gratis a cambio|a cambio de|sorteo|premio|beneficio|cup[oó]n|\bgratis\b/i;
const URGENCY = /urgente|hoy mismo|antes del|[uú]ltim[oa] (d[ií]a|oportunidad)|ahora mismo|cuanto antes/i;
const ONLY_POSITIVE = /5 estrellas|cinco estrellas|reseña positiva|buena reseña/i;

const allTexts = () => [
  ...r.REVIEW_TEMPLATES,
  r.buildReviewRequest({ businessName: "Panadería Sol", googleReviewUrl: GOOGLE }).body,
  r.buildReviewRequest({ businessName: "Panadería Sol", googleReviewUrl: "" }).body,
  r.buildMessage({
    kind: "pedir_resena",
    businessName: "Panadería Sol",
    offerName: null,
    amountLabel: null,
    dateLabel: null,
    periodLabel: null,
    link: GOOGLE,
  }),
];

// Redacción
check("sin incentivos a cambio de reseñas", () => {
  for (const t of allTexts()) assert.doesNotMatch(t, INCENTIVE, t);
});
check("sin urgencia falsa", () => {
  for (const t of allTexts()) assert.doesNotMatch(t, URGENCY, t);
});
check("no pide solo reseñas positivas", () => {
  for (const t of allTexts()) assert.doesNotMatch(t, ONLY_POSITIVE, t);
});
check("plantillas en constantes no vacías", () => {
  assert.ok(r.REVIEW_TEMPLATES.length >= 5);
  for (const t of r.REVIEW_TEMPLATES) assert.ok(typeof t === "string" && t.trim().length > 0);
});
check("mensaje corto (< 900 caracteres)", () => {
  for (const t of allTexts()) assert.ok(t.length < 900, `${t.length} caracteres`);
});

// Mensaje
check("con link: pide reseña de Google con el link y testimonio opcional", () => {
  const m = r.buildReviewRequest({ businessName: "Panadería Sol", googleReviewUrl: GOOGLE });
  assert.equal(m.includesGoogle, true);
  assert.match(m.body, /reseña en Google/);
  assert.ok(m.body.includes(GOOGLE));
  assert.match(m.body, /testimonio/);
  assert.match(m.body, /^Hola, equipo de Panadería Sol/);
  assert.equal(m.subject, r.REVIEW_SUBJECT);
});
check("sin link: solo testimonio, sin mencionar Google", () => {
  for (const url of ["", null, undefined, "   ", "http://inseguro.cl", "no es url", "javascript:alert(1)"]) {
    const m = r.buildReviewRequest({ businessName: "Panadería Sol", googleReviewUrl: url });
    assert.equal(m.includesGoogle, false, String(url));
    assert.doesNotMatch(m.body, /Google|https?:/);
    assert.match(m.body, /testimonio/);
  }
});
check("saluda al contacto por su primer nombre", () => {
  const m = r.buildReviewRequest({ businessName: "Panadería Sol", contactName: "  María José Pérez " });
  assert.match(m.body, /^Hola María, ¿cómo estás\?/);
});
check("aviso de link faltante", () =>
  assert.equal(r.REVIEW_MISSING_URL_NOTICE, "Configura tu link de reseñas de Google (VITE_GOOGLE_REVIEW_URL)"));
check("GOOGLE_REVIEW_URL vacío fuera de Vite", () => assert.equal(r.GOOGLE_REVIEW_URL, ""));
check("plantilla de seguimiento pedir_resena con firma", () => {
  const m = r.buildMessage({
    kind: "pedir_resena",
    businessName: "Panadería Sol",
    offerName: null,
    amountLabel: null,
    dateLabel: null,
    periodLabel: null,
    link: null,
  });
  assert.match(m, /testimonio/);
  assert.match(m, /Benjamín · Vibranding$/);
});

// Cuándo sugerir
const moment = (over = {}) =>
  r.isGoodMomentForReview({
    clientStatus: "activo",
    startedAt: "2026-08-01",
    healthLevel: "bien",
    healthReasonCodes: [],
    hasOverduePayments: false,
    lastAskedYmd: null,
    today: TODAY,
    ...over,
  });
check("cliente contento, 80 días, al día = sí", () => assert.equal(moment(), true));
check("exactamente 60 días = sí; 59 = no", () => {
  assert.equal(moment({ startedAt: "2026-08-21" }), true);
  assert.equal(moment({ startedAt: "2026-08-22" }), false);
});
check("salud distinta de bien = no", () => {
  for (const level of ["atencion", "en_riesgo", "sin_datos", null, undefined]) {
    assert.equal(moment({ healthLevel: level }), false, String(level));
  }
});
check("cobro vencido = no", () => {
  assert.equal(moment({ hasOverduePayments: true }), false);
  assert.equal(moment({ healthReasonCodes: ["cobro_vencido"] }), false);
});
check("no activo = no", () => {
  for (const status of ["onboarding", "pausado", "terminado", "prospecto"]) {
    assert.equal(moment({ clientStatus: status }), false, status);
  }
});
check("sin fecha de inicio = no", () => assert.equal(moment({ startedAt: null }), false));
check("pedida hace < 90 días = no; 90 o más = sí", () => {
  assert.equal(moment({ lastAskedYmd: "2026-07-23" }), false); // 89 días
  assert.equal(moment({ lastAskedYmd: "2026-07-22" }), true); // 90 días
});
check("acepta timestamps ISO como inicio", () => assert.equal(moment({ startedAt: "2026-08-01T15:00:00Z" }), true));

// localStorage
check("clave por usuario", () => assert.equal(r.reviewAskedStorageKey("u1"), "vb:resenas:pedida:u1"));
check("parse descarta basura y pedidos de hace 90+ días", () => {
  const map = r.parseReviewAsked(JSON.stringify({ a: "2026-10-01", b: "2026-07-01", c: 3, d: "x" }), TODAY);
  assert.deepEqual(map, { a: "2026-10-01" });
  assert.deepEqual(r.parseReviewAsked("{no json", TODAY), {});
  assert.deepEqual(r.parseReviewAsked("[1]", TODAY), {});
  assert.deepEqual(r.parseReviewAsked(null, TODAY), {});
});
check("withReviewAsked no muta", () => {
  const base = Object.freeze({ a: "2026-10-01" });
  const next = r.withReviewAsked(base, "b", TODAY);
  assert.deepEqual(next, { a: "2026-10-01", b: TODAY });
  assert.deepEqual(base, { a: "2026-10-01" });
});

// Sugerencias para "Inicio"
const cand = (over = {}) => ({
  id: "c1",
  name: "Panadería Sol",
  status: "activo",
  created_at: "2026-01-01T00:00:00Z",
  started_at: "2026-08-01",
  phone: "+56 9 1234 5678",
  ...over,
});
const suggest = (over = {}) =>
  r.reviewFollowups({
    candidates: [cand()],
    health: new Map([["c1", { level: "bien", reasonCodes: [] }]]),
    overdueClientIds: new Set(),
    asked: {},
    today: TODAY,
    googleReviewUrl: GOOGLE,
    ...over,
  });
check("sugiere pedir_resena con prioridad baja y link de Google", () => {
  const [f, ...rest] = suggest();
  assert.equal(rest.length, 0);
  assert.equal(f.id, "pedir_resena:c1");
  assert.equal(f.kind, "pedir_resena");
  assert.equal(f.priority, "baja");
  assert.deepEqual(f.link, { kind: "absolute", url: GOOGLE });
  assert.deepEqual(f.target, { screen: "client", clientId: "c1" });
  assert.equal(f.whatsappPhone, "+56 9 1234 5678");
  assert.equal(f.recordsProspectContact, false);
  assert.match(f.reason, /80 días/);
});
check("sin link de Google: sin link en la sugerencia", () => assert.equal(suggest({ googleReviewUrl: "" })[0].link, null));
check("teléfono inválido: sin WhatsApp", () =>
  assert.equal(suggest({ candidates: [cand({ phone: "123" })] })[0].whatsappPhone, null));
check("no sugiere si ya se pidió en 90 días", () => assert.equal(suggest({ asked: { c1: "2026-09-01" } }).length, 0));
check("no sugiere con cobro vencido", () => assert.equal(suggest({ overdueClientIds: new Set(["c1"]) }).length, 0));
check("no sugiere sin salud calculada", () => assert.equal(suggest({ health: new Map() }).length, 0));
check("usa created_at si no hay started_at", () => {
  assert.equal(suggest({ candidates: [cand({ started_at: null })] }).length, 1);
  assert.equal(suggest({ candidates: [cand({ started_at: null, created_at: "2026-10-01T00:00:00Z" })] }).length, 0);
});

if (failures.length > 0) {
  console.error(`check-reviews: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-reviews: OK");
