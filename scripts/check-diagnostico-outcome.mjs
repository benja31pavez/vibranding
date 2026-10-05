#!/usr/bin/env node
/**
 * Revisa el resultado del formulario /diagnostico (src/lib/leads/diagnostico.outcome.ts):
 * un lead no guardado nunca responde ok:true, y los logs no llevan correos.
 * Uso: node scripts/check-diagnostico-outcome.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "diagnostico-outcome-check-"));
const outFile = join(outDir, "outcome.mjs");

await build({
  entryPoints: [join(root, "src/lib/leads/diagnostico.outcome.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  alias: { "@": join(root, "src") },
  logLevel: "error",
});

const o = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

check("created y noted = ok", () => {
  assert.deepEqual(o.resultForOutcome("created"), { ok: true });
  assert.deepEqual(o.resultForOutcome("noted"), { ok: true });
});
check("error y no_org = not_saved (fallback WhatsApp)", () => {
  assert.deepEqual(o.resultForOutcome("error"), { ok: false, reason: "not_saved" });
  assert.deepEqual(o.resultForOutcome("no_org"), { ok: false, reason: "not_saved" });
});
check("línea LEAD_PERDIDO estable y sin hash completo", () => {
  const hash = "a".repeat(64);
  const line = o.leadLostLine({
    outcome: "error",
    step: "insert prospects",
    code: "23503",
    emailHash: hash,
  });
  assert.ok(line.startsWith("[diagnostico][LEAD_PERDIDO] "), line);
  assert.match(line, /outcome=error step=insert prospects code=23503 email_hash=a{12}$/);
  assert.equal(line.includes(hash), false);
});
check("línea sin código ni hash", () => {
  assert.equal(
    o.leadLostLine({ outcome: "no_org", step: "x" }),
    "[diagnostico][LEAD_PERDIDO] outcome=no_org step=x code=?",
  );
});
check("snippet oculta correos y se acorta", () => {
  assert.equal(o.safeSnippet("Resend 422 (to: ana.perez@gmail.com)"), "Resend 422 (to: [email])");
  assert.ok(o.safeSnippet("x".repeat(500)).length <= 200);
});

if (failures.length > 0) {
  console.error(`check-diagnostico-outcome: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-diagnostico-outcome: OK");
