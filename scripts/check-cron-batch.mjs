#!/usr/bin/env node
/**
 * Revisa los helpers de lotes del cron (src/lib/cron/batch.ts).
 * Uso: node scripts/check-cron-batch.mjs
 */
import { build } from "esbuild";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "cron-batch-check-"));
const outFile = join(outDir, "batch.mjs");

await build({
  entryPoints: [join(root, "src/lib/cron/batch.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  alias: { "@": join(root, "src") },
  logLevel: "error",
});

const b = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}
const q = (s) => new URLSearchParams(s);
const opts = { defaultLimit: 3, maxLimit: 3 };

check("parseBatchParams usa valores por defecto", () =>
  assert.deepEqual(b.parseBatchParams(q(""), opts), { offset: 0, limit: 3, last: false }));
check("parseBatchParams lee offset, limit y last", () =>
  assert.deepEqual(b.parseBatchParams(q("offset=21&limit=2&last=1"), opts), {
    offset: 21,
    limit: 2,
    last: true,
  }));
check("parseBatchParams rechaza limit sobre el tope", () =>
  assert.ok("error" in b.parseBatchParams(q("limit=4"), opts)));
check("parseBatchParams rechaza limit 0", () =>
  assert.ok("error" in b.parseBatchParams(q("limit=0"), opts)));
check("parseBatchParams rechaza offset negativo o no entero", () => {
  assert.ok("error" in b.parseBatchParams(q("offset=-3"), opts));
  assert.ok("error" in b.parseBatchParams(q("offset=1.5"), opts));
  assert.ok("error" in b.parseBatchParams(q("offset=abc"), opts));
});
check("parseBatchParams rechaza last inválido", () =>
  assert.ok("error" in b.parseBatchParams(q("last=yes"), opts)));
check("parseLastFlag acepta 0", () => assert.equal(b.parseLastFlag(q("last=0")), false));

check("missingBatchesError: no es el último job", () =>
  assert.equal(b.missingBatchesError(false, 24), null));
check("missingBatchesError: último job sin cuentas pendientes", () =>
  assert.equal(b.missingBatchesError(true, null), null));
check("missingBatchesError: último job con cuentas pendientes", () =>
  assert.equal(b.missingBatchesError(true, 24), "faltan lotes: agrega un job con offset 24"));

check("batchStatus: cualquier fallo es 500 (job_runs toma 207 como éxito)", () => {
  assert.equal(b.batchStatus(0), 200);
  assert.equal(b.batchStatus(1), 500);
  assert.equal(b.batchStatus(3), 500);
});

check("isBatchedCall solo con offset", () => {
  assert.equal(b.isBatchedCall(q("offset=0&limit=3")), true);
  assert.equal(b.isBatchedCall(q("")), false);
  assert.equal(b.isBatchedCall(q("date=2026-10-01")), false);
});
check("CRON_CALL_BUDGET_MS bajo los 15 s del cron", () => assert.ok(b.CRON_CALL_BUDGET_MS < 15_000));

check("splitBatch con más filas que el límite", () =>
  assert.deepEqual(b.splitBatch([1, 2, 3, 4], 6, 3), { batch: [1, 2, 3], nextOffset: 9 }));
check("splitBatch en el último lote", () =>
  assert.deepEqual(b.splitBatch([1, 2], 6, 3), { batch: [1, 2], nextOffset: null }));
check("splitBatch exactamente el límite", () =>
  assert.deepEqual(b.splitBatch([1, 2, 3], 0, 3), { batch: [1, 2, 3], nextOffset: null }));
check("META_MAX_BATCH_LIMIT es 3", () => assert.equal(b.META_MAX_BATCH_LIMIT, 3));

// withDeadline (async)
const timedOut = () => "pendiente";
const slow = new Promise((r) => setTimeout(() => r("ok"), 200));
const asyncChecks = [
  ["withDeadline devuelve el resultado a tiempo", async () =>
    assert.equal(await b.withDeadline(Promise.resolve("ok"), Date.now() + 1000, timedOut), "ok")],
  ["withDeadline corta al vencer el plazo", async () =>
    assert.equal(await b.withDeadline(slow, Date.now() + 20, timedOut), "pendiente")],
  ["withDeadline con plazo ya vencido", async () =>
    assert.equal(await b.withDeadline(Promise.resolve("ok"), Date.now() - 1, timedOut), "pendiente")],
];
for (const [name, fn] of asyncChecks) {
  try {
    await fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

// Toda ruta que llama el cron (URLs de run_http_cron_job en las migraciones)
// debe responder con batchStatus y nunca 207: job_runs toma cualquier 2xx como éxito.
const migDir = join(root, "supabase/migrations");
const cronPaths = new Set();
for (const f of readdirSync(migDir).filter((n) => n.endsWith(".sql"))) {
  const sql = readFileSync(join(migDir, f), "utf8");
  for (const m of sql.matchAll(/https?:\/\/[^'\s?]+?(\/api\/public\/[\w\-/]+)/g)) cronPaths.add(m[1]);
}
check("hay rutas llamadas por el cron", () => assert.ok(cronPaths.size > 0));
for (const path of [...cronPaths].sort()) {
  check(`ruta cron ${path} usa batchStatus y no responde 207`, () => {
    const file = join(root, "src/routes", `${path}.ts`);
    assert.ok(existsSync(file), `no existe ${file}`);
    const src = readFileSync(file, "utf8");
    assert.ok(src.includes("batchStatus("), "no usa batchStatus");
    assert.ok(!/(status\s*:|\?|:)\s*207\b/.test(src), "responde 207");
  });
}

if (failures.length > 0) {
  console.error(`check-cron-batch: ${failures.length} fallo(s)`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("check-cron-batch: OK");
