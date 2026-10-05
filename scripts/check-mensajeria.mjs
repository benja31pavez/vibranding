#!/usr/bin/env node
/**
 * Revisa los helpers de entrega sin pérdida (src/lib/messaging/delivery.ts):
 * status del webhook de Instagram, duplicados (23505) y plan de reintentos
 * del dispatch de WhatsApp.
 * Uso: node scripts/check-mensajeria.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "mensajeria-check-"));
const outFile = join(outDir, "delivery.mjs");

await build({
  entryPoints: [join(root, "src/lib/messaging/delivery.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  alias: { "@": join(root, "src") },
  logLevel: "error",
});

const d = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
  }
}

check("webhook 200 sin fallos", () => assert.equal(d.webhookStatus(0), 200));
check("webhook 500 con fallos", () => assert.equal(d.webhookStatus(2), 500));

check("23505 es duplicado", () => assert.equal(d.isUniqueViolation({ code: "23505", message: "x" }), true));
check("mensaje duplicate key es duplicado", () =>
  assert.equal(d.isUniqueViolation({ message: 'duplicate key value violates unique constraint "idx_wa_msg_waid"' }), true));
check("otro error no es duplicado", () => assert.equal(d.isUniqueViolation({ code: "08006", message: "connection" }), false));
check("null no es duplicado", () => assert.equal(d.isUniqueViolation(null), false));

check("insert sin error = inserted", () => assert.equal(d.classifyInsert(null, "t"), "inserted"));
check("insert 23505 = duplicate", () => assert.equal(d.classifyInsert({ code: "23505" }, "t"), "duplicate"));
check("insert otro error lanza", () =>
  assert.throws(() => d.classifyInsert({ code: "57014", message: "timeout" }, "ctx"), /ctx: timeout/));

const now = new Date("2026-10-05T12:00:00.000Z");
check("1er fallo reprograma +30s", () =>
  assert.deepEqual(d.planDispatchRetry(0, now), {
    escalate: false,
    attempts: 1,
    pendingResponseAt: "2026-10-05T12:00:30.000Z",
  }));
check("2do fallo reprograma", () => assert.equal(d.planDispatchRetry(1, now).escalate, false));
check("3er fallo escala a humano", () =>
  assert.deepEqual(d.planDispatchRetry(2, now), { escalate: true, attempts: 3, pendingResponseAt: null }));
check("contador null/basura parte en 0", () => {
  assert.equal(d.planDispatchRetry(null, now).attempts, 1);
  assert.equal(d.planDispatchRetry(undefined, now).attempts, 1);
  assert.equal(d.planDispatchRetry(-4, now).attempts, 1);
});
check("motivo de escalamiento acotado", () => {
  const r = d.escalationReason("x".repeat(500));
  assert.match(r, /3 intentos/);
  assert.ok(r.length < 200);
});

check("redacta teléfonos", () => {
  assert.equal(d.redactDigits("to 56912345678 failed"), "to [redactado] failed");
  assert.equal(d.redactDigits("HTTP 500"), "HTTP 500");
});
check("escalamiento redacta y pausa motivo", () => assert.doesNotMatch(d.escalationReason("send 56912345678"), /\d{7,}/));
check("transitorio: sin código / red", () => assert.equal(d.isTransientError(new Error("fetch failed")), true));
check("transitorio: conexión 08006", () => assert.equal(d.isTransientError(Object.assign(new Error("x"), { code: "08006" })), true));
check("transitorio: HTTP 503 y 429", () => {
  assert.equal(d.isTransientError({ status: 503 }), true);
  assert.equal(d.isTransientError({ status: 429 }), true);
});
check("permanente: HTTP 400 de Meta", () => assert.equal(d.isTransientError({ status: 400 }), false));
check("permanente: esquema 42703 / PGRST204", () => {
  assert.equal(d.isTransientError({ code: "42703" }), false);
  assert.equal(d.isTransientError({ code: "PGRST204" }), false);
});
check("permanente: PermanentError", () => assert.equal(d.isTransientError(new d.PermanentError("token revocado")), false));
check("dbError conserva el código", () => {
  const e = d.dbError("ctx", { code: "23502", message: "null value" });
  assert.equal(e.code, "23502");
  assert.equal(e.message, "ctx: null value");
  assert.equal(d.isTransientError(e), false);
});
check("lease de 5 min y timeout 15s", () => {
  assert.equal(d.DISPATCH_LEASE_MS, 300000);
  assert.equal(d.OUTBOUND_TIMEOUT_MS, 15000);
});

if (failures.length) {
  console.error(`check-mensajeria: ${failures.length} fallo(s)`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("check-mensajeria: OK");
