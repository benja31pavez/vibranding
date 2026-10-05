#!/usr/bin/env node
/**
 * Revisa el cálculo del embudo y de la meta de MRR (src/lib/growth).
 * Uso: node scripts/check-growth.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "growth-check-"));
const entry = join(outDir, "entry.ts");
const outFile = join(outDir, "growth.mjs");
writeFileSync(
  entry,
  `export * from ${JSON.stringify(join(root, "src/lib/growth/funnel.ts"))};\n` +
    `export * from ${JSON.stringify(join(root, "src/lib/growth/goal.ts"))};\n`,
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

const g = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

const prospect = (id, estado, extra = {}) => ({
  id,
  estado,
  fuente: "web: diagnóstico",
  created_at: "2026-09-01T12:00:00Z",
  ultimo_contacto: null,
  client_id: null,
  ...extra,
});

const prospects = [
  prospect("a", "nuevo"),
  prospect("b", "contactado", { fuente: "Oficina de agentes · cazamarcas (ig)" }),
  prospect("c", "frio", { fuente: "Oficina de agentes · cazamarcas (ig)" }),
  prospect("d", "propuesta"),
  prospect("e", "ganado", { fuente: "Referido por Juan" }),
  prospect("f", "nuevo", { fuente: "Referido" }), // tiene propuesta aceptada
  prospect("g", "baja"), // excluido
  prospect("h", "nuevo", { ultimo_contacto: "2026-09-02T12:00:00Z", fuente: "" }),
  // c (frío sin contacto) no cuenta como contactado.
];
const proposals = [
  { prospect_id: "d", status: "vista", sent_at: "2026-09-05T12:00:00Z", accepted_at: null },
  { prospect_id: "e", status: "aceptada", sent_at: "2026-09-05T12:00:00Z", accepted_at: "2026-09-11T12:00:00Z" },
  { prospect_id: "f", status: "aceptada", sent_at: "2026-09-02T12:00:00Z", accepted_at: "2026-09-21T12:00:00Z" },
  { prospect_id: "g", status: "aceptada", sent_at: "2026-09-02T12:00:00Z", accepted_at: "2026-09-03T12:00:00Z" },
  { prospect_id: null, status: "aceptada", sent_at: null, accepted_at: "2026-09-03T12:00:00Z" },
];

check("conversionPct", () => {
  assert.equal(g.conversionPct(1, 3), 33.3);
  assert.equal(g.conversionPct(0, 0), null);
  assert.equal(g.conversionPct(2, 2), 100);
});

check("median", () => {
  assert.equal(g.median([]), null);
  assert.equal(g.median([5, 1, 3]), 3);
  assert.equal(g.median([10, 20]), 15);
});

check("embudo: etapas, baja excluida, frío cuenta", () => {
  const f = g.computeFunnel(prospects, proposals);
  const counts = Object.fromEntries(f.stages.map((s) => [s.key, s.count]));
  assert.deepEqual(counts, { nuevos: 7, contactados: 5, propuesta: 3, ganados: 2 });
  assert.equal(f.stages[0].conversionFromPrev, null);
  assert.equal(f.stages[1].conversionFromPrev, 71.4);
  assert.equal(f.stages[2].conversionFromPrev, 60);
  assert.equal(f.stages[3].conversionFromPrev, 66.7);
  assert.equal(f.overallConversion, 28.6);
  // e: 10 días, f: 20 días → mediana 15.
  assert.equal(f.medianDaysToClose, 15);
  assert.equal(f.closedWithDate, 2);
});

check("embudo: perdido/frío solo cuentan como contactados con señal", () => {
  const f = g.computeFunnel(
    [
      prospect("p1", "perdido"),
      prospect("p2", "perdido", { ultimo_contacto: "2026-09-03T12:00:00Z" }),
      prospect("p3", "frio"),
      prospect("p4", "frio"),
    ],
    [{ prospect_id: "p4", status: "rechazada", sent_at: "2026-09-04T12:00:00Z", accepted_at: null }],
  );
  const counts = Object.fromEntries(f.stages.map((s) => [s.key, s.count]));
  assert.deepEqual(counts, { nuevos: 4, contactados: 2, propuesta: 1, ganados: 0 });
});

check("embudo: etapas monótonas y vacío", () => {
  const f = g.computeFunnel(prospects, proposals);
  for (let i = 1; i < f.stages.length; i++) assert.ok(f.stages[i].count <= f.stages[i - 1].count);
  const empty = g.computeFunnel([], []);
  assert.equal(empty.overallConversion, null);
  assert.ok(empty.stages.every((s) => s.count === 0 && (s.conversionFromPrev ?? null) === null));
});

check("fuentes", () => {
  assert.equal(g.classifySource("web: diagnóstico"), "Web · diagnóstico");
  assert.equal(g.classifySource("Oficina de agentes · cazamarcas (x)"), "Cazamarcas");
  assert.equal(g.classifySource("Instagram (oficina de agentes)"), "Oficina de agentes");
  assert.equal(g.classifySource("perfil de Instagram"), "Instagram");
  assert.equal(g.classifySource("Metalúrgica amiga"), "Otro");
  assert.equal(g.classifySource(""), "Otro");
  const rows = g.computeSources(prospects, proposals);
  assert.deepEqual(rows[0], { source: "Referido", nuevos: 2, propuestas: 2, ganados: 2, winRate: 100 });
  const web = rows.find((r) => r.source === "Web · diagnóstico");
  assert.deepEqual(web, { source: "Web · diagnóstico", nuevos: 2, propuestas: 1, ganados: 0, winRate: 0 });
  assert.equal(rows.reduce((acc, r) => acc + r.nuevos, 0), 7);
});

check("meta: meses restantes", () => {
  assert.equal(g.monthsRemaining("2026-10", "2027-04"), 6);
  assert.equal(g.monthsRemaining("2027-04", "2027-04"), 0);
  assert.equal(g.monthsRemaining("2027-06", "2027-04"), 0);
  assert.deepEqual(g.lastMonths("2027-02", 4), ["2026-11", "2026-12", "2027-01", "2027-02"]);
});

check("meta: clientes que faltan", () => {
  const s = g.computeGoal({
    mrr: 389_970, goal: 1_000_000, recurringClients: 3, fallbackTicket: 129_990, currentMonth: "2026-10",
  });
  assert.equal(s.avgTicket, 129_990);
  assert.equal(s.gap, 610_030);
  assert.equal(s.clientsNeeded, 5);
  assert.equal(s.clientsPerMonth, 1);
  assert.equal(s.progressPct, 38.9);
  const zero = g.computeGoal({
    mrr: 0, goal: 1_000_000, recurringClients: 0, fallbackTicket: 129_990, currentMonth: "2026-10",
  });
  assert.equal(zero.ticketIsFallback, true);
  assert.equal(zero.clientsNeeded, 8);
  assert.equal(zero.clientsPerMonth, 2);
  const done = g.computeGoal({
    mrr: 1_200_000, goal: 1_000_000, recurringClients: 5, fallbackTicket: 129_990, currentMonth: "2026-10",
  });
  assert.equal(done.clientsNeeded, 0);
  assert.equal(done.progressPct, 100);
  const almost = g.computeGoal({
    mrr: 999_999, goal: 1_000_000, recurringClients: 5, fallbackTicket: 129_990, currentMonth: "2026-10",
  });
  assert.equal(almost.progressPct, 99.9);
  assert.equal(almost.clientsNeeded, 1);
  assert.equal(almost.pastDeadline, false);
  const late = g.computeGoal({
    mrr: 100, goal: 1_000_000, recurringClients: 1, fallbackTicket: 129_990, currentMonth: "2027-05",
  });
  assert.equal(late.pastDeadline, true);
  assert.equal(late.monthsRemaining, 0);
});

check("tendencia mensual", () => {
  const t = g.monthlyTrend(
    [
      { amount: 129990, currency: "CLP", month: "2026-09" },
      { amount: "249990", currency: "CLP", month: "2026-09" },
      { amount: 200, currency: "USD", month: "2026-09" },
      { amount: 1, currency: "CLP", month: "2025-01" },
    ],
    ["2026-08", "2026-09"],
  );
  assert.deepEqual(t, [
    { month: "2026-08", collected: 0 },
    { month: "2026-09", collected: 379980 },
  ]);
});

if (failures.length) {
  console.error(`check-growth: ${failures.length} fallo(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("check-growth: OK");
