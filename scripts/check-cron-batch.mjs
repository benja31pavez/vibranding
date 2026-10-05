#!/usr/bin/env node
/**
 * Revisa los helpers de lotes del cron (src/lib/cron/batch.ts).
 * Uso: node scripts/check-cron-batch.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
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

check("batchStatus", () => {
  assert.equal(b.batchStatus(0, 0), 200);
  assert.equal(b.batchStatus(0, 3), 200);
  assert.equal(b.batchStatus(1, 2), 207);
  assert.equal(b.batchStatus(3, 0), 500);
});

check("splitBatch con más filas que el límite", () =>
  assert.deepEqual(b.splitBatch([1, 2, 3, 4], 6, 3), { batch: [1, 2, 3], nextOffset: 9 }));
check("splitBatch en el último lote", () =>
  assert.deepEqual(b.splitBatch([1, 2], 6, 3), { batch: [1, 2], nextOffset: null }));
check("splitBatch exactamente el límite", () =>
  assert.deepEqual(b.splitBatch([1, 2, 3], 0, 3), { batch: [1, 2, 3], nextOffset: null }));
check("META_MAX_BATCH_LIMIT es 3", () => assert.equal(b.META_MAX_BATCH_LIMIT, 3));

if (failures.length > 0) {
  console.error(`check-cron-batch: ${failures.length} fallo(s)`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("check-cron-batch: OK");
