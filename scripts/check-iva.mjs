#!/usr/bin/env node
/**
 * Revisa el modelo de precios netos + IVA (src/lib/pricing/iva.ts y plans.ts).
 * Uso: node scripts/check-iva.mjs
 *
 *  - withIva / ivaOf / netOfTotal: redondeo a peso entero y consistencia.
 *  - Precios de lista netos (decisión 2026-10-05) y Plan Mantención oculto.
 *  - Propuestas: la línea del plan cobra neto × 1,19.
 *  - La home (translations) y llms.txt usan los mismos netos y no muestran Mantención.
 *  - Guardia: no queda "IVA incluido" en src/ ni en public/ (salvo comentarios).
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "iva-check-"));
const entry = join(outDir, "entry.ts");
const outFile = join(outDir, "iva.mjs");
writeFileSync(
  entry,
  [
    `export * from ${JSON.stringify(join(root, "src/lib/pricing/iva.ts"))};`,
    `export * as plans from ${JSON.stringify(join(root, "src/lib/pricing/plans.ts"))};`,
    `export * as proposals from ${JSON.stringify(join(root, "src/lib/proposals/model.ts"))};`,
    `export { translations } from ${JSON.stringify(join(root, "src/i18n/translations.ts"))};`,
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

const m = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

// ── Helper ──────────────────────────────────────────────────────────────────
check("IVA 19%", () => {
  assert.equal(m.IVA_RATE, 0.19);
  assert.equal(m.IVA_LABEL, "19%");
});
check("precios de lista → total a pagar (redondeo a peso)", () => {
  assert.equal(m.withIva(149_990), 178_488);
  assert.equal(m.withIva(129_990), 154_688);
  assert.equal(m.withIva(249_990), 297_488);
  assert.equal(m.withIva(69_990), 83_288);
  assert.equal(m.ivaOf(129_990), 24_698);
  assert.equal(m.withIva(0), 0);
});
check("neto + IVA = total y el total vuelve al neto", () => {
  for (let net = -50_000; net <= 400_000; net += 7) {
    assert.equal(net + m.ivaOf(net), m.withIva(net), `neto ${net}`);
    assert.equal(m.netOfTotal(m.withIva(net)), net, `ida y vuelta ${net}`);
    assert.ok(Number.isInteger(m.withIva(net)), `entero ${net}`);
  }
});
check("desgloses", () => {
  assert.deepEqual(m.breakdownFromNet(129_990), { net: 129_990, iva: 24_698, total: 154_688 });
  // Registro antiguo con "IVA incluido": se lee tal cual.
  assert.deepEqual(m.breakdownFromTotal(129_990), { net: 109_235, iva: 20_755, total: 129_990 });
});
check("valores no numéricos no rompen", () => {
  assert.equal(m.withIva(Number.NaN), 0);
  assert.equal(m.netOfTotal(Number.POSITIVE_INFINITY), 0);
});

// ── Planes ──────────────────────────────────────────────────────────────────
const NET = { "marca-web": 149_990, contenido: 129_990, crecimiento: 249_990, mantencion: 69_990 };
check("precios netos de lista (decisión 2026-10-05)", () => {
  for (const [key, net] of Object.entries(NET)) {
    const plan = m.plans.findPlan(key);
    assert.ok(plan, key);
    assert.equal(plan.netPrice, net, key);
    assert.equal(m.plans.planTotal(plan), m.withIva(net), key);
  }
  assert.equal(m.plans.PLANS.length, Object.keys(NET).length);
});
check("Mantención: mensual, solo ex clientes y no pública", () => {
  const plan = m.plans.findPlan("mantencion");
  assert.equal(plan.billing, "monthly");
  assert.equal(plan.isPublic, false);
  assert.equal(plan.returningClientsOnly, true);
  assert.deepEqual(
    m.plans.PUBLIC_PLANS.map((p) => p.key),
    ["marca-web", "contenido", "crecimiento"],
  );
});
check('etiquetas "+ IVA"', () => {
  assert.equal(m.plans.planNetLabel(m.plans.findPlan("contenido")), "$129.990 + IVA/mes");
  assert.equal(m.plans.planNetLabel(m.plans.findPlan("marca-web")), "$149.990 + IVA (pago único)");
  assert.equal(m.plans.planPriceLabel(m.plans.findPlan("mantencion")), "$69.990 + IVA/mes");
});

// ── Propuestas ──────────────────────────────────────────────────────────────
check("la línea del plan cobra neto × 1,19", () => {
  const items = [m.proposals.planItem("contenido")];
  assert.equal(items[0].amount, 154_688);
  const t = m.proposals.computeTotals(items);
  assert.equal(t.firstCharge, 154_688);
  assert.equal(t.firstChargeNet, 129_990);
  assert.equal(t.firstChargeIva, 24_698);
});
check("adicional en neto y descuento", () => {
  const items = [
    m.proposals.planItem("marca-web"),
    m.proposals.extraItemFromNet({ label: "Landing extra", billing: "one_time" }, 50_000),
    m.proposals.extraItemFromNet({ label: "Descuento", billing: "one_time" }, -10_000),
  ];
  const t = m.proposals.computeTotals(items);
  assert.equal(t.oneTimeNet, 189_990);
  assert.equal(t.oneTime, 178_488 + 59_500 - 11_900);
  assert.equal(t.firstChargeIva, t.firstCharge - t.firstChargeNet);
});
check("propuesta antigua (precio con IVA) se lee tal cual", () => {
  const legacy = [
    {
      type: "plan",
      key: "contenido",
      label: "Plan Contenido",
      amount: 129_990,
      billing: "monthly",
    },
  ];
  const t = m.proposals.computeTotals(legacy);
  assert.equal(t.firstCharge, 129_990);
  assert.equal(t.firstChargeNet, 109_235);
  assert.equal(m.proposals.isStalePlanItem(legacy[0]), true);
  assert.equal(m.proposals.isStalePlanItem(m.proposals.planItem("contenido")), false);
});
check("condiciones: precios netos + IVA", () => {
  const conditions = m.proposals.proposalConditions("contenido", [
    m.proposals.planItem("contenido"),
  ]);
  assert.ok(conditions.some((c) => /netos/.test(c) && /IVA/.test(c)));
});

// ── Sitio público ───────────────────────────────────────────────────────────
check("home: mismos netos que plans.ts y sin Mantención", () => {
  for (const item of m.translations.es.home.plans.items) {
    assert.equal(item.price, m.plans.findPlan(item.id)?.netPrice, item.id);
    assert.ok(m.plans.findPlan(item.id)?.isPublic, item.id);
  }
  assert.match(m.translations.es.home.hero.priceLine, /\$129\.990 \+ IVA\/mes/);
});
check("llms.txt: precios + IVA y sin Mantención", () => {
  const llms = readFileSync(join(root, "public/llms.txt"), "utf8");
  for (const key of ["marca-web", "contenido", "crecimiento"]) {
    const price = m.plans.formatMoney(m.plans.findPlan(key).netPrice);
    assert.ok(llms.includes(`${price} + IVA`), `${key}: falta "${price} + IVA"`);
  }
  assert.doesNotMatch(llms, /manten/i);
});

// ── Guardia: "IVA incluido" ─────────────────────────────────────────────────
const VAT_INCLUDED = /iva incluido|incluyen iva|incluye iva|valueAddedTaxIncluded:\s*true/i;
const SCAN_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".txt", ".html", ".json", ".md"]);
const SKIP_DIRS = new Set(["node_modules", "integrations"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(path);
    } else if (SCAN_EXT.has(extname(name))) {
      yield path;
    }
  }
}

/** Línea de comentario: //, /*, * o {/* (JSX). */
function isComment(line) {
  return /^(\/\/|\/\*|\*|\{\/\*)/.test(line.trim());
}

check('sin "IVA incluido" en src/ ni public/ (salvo comentarios)', () => {
  const hits = [];
  for (const base of ["src", "public"]) {
    for (const file of walk(join(root, base))) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, idx) => {
          if (VAT_INCLUDED.test(line) && !isComment(line)) {
            hits.push(`${relative(root, file)}:${idx + 1}`);
          }
        });
    }
  }
  assert.deepEqual(hits, []);
});

if (failures.length > 0) {
  console.error(`check-iva: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-iva: OK");
