#!/usr/bin/env node
/**
 * Revisa las cabeceras de seguridad globales (src/lib/security/headers.ts).
 * Uso: node scripts/check-security-headers.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "security-headers-check-"));
const outFile = join(outDir, "headers.mjs");

await build({
  entryPoints: [join(root, "src/lib/security/headers.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  alias: { "@": join(root, "src") },
  logLevel: "error",
});

const h = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
const test = (name, fn) => {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`FAIL ${name}\n     ${e.message}`);
  }
};
const u = (s) => new URL(s);

test("producción: DENY + frame-ancestors 'none' + nosniff + referrer", () => {
  for (const url of [
    "https://vibranding.pro/",
    "https://vibranding.pro/clients/x/landing",
    "https://vibranding.lovable.app/m/foo",
  ]) {
    const r = h.securityHeadersFor(u(url));
    assert.equal(r["X-Frame-Options"], "DENY", url);
    assert.equal(r["Content-Security-Policy"], "frame-ancestors 'none'", url);
    assert.equal(r["X-Content-Type-Options"], "nosniff", url);
    assert.equal(r["Referrer-Policy"], "strict-origin-when-cross-origin", url);
  }
});

test("hosts de vista previa de Lovable: permiten lovable.dev, sin X-Frame-Options", () => {
  for (const host of [
    "id-preview--e7caaa14-14c5-42d8-b5b5-4cde48ca5360.lovable.app",
    "id-preview-f7ff2cc0--e7caaa14-14c5-42d8-b5b5-4cde48ca5360.lovable.app",
    "e7caaa14-14c5-42d8-b5b5-4cde48ca5360.lovableproject.com",
    "preview--client-hub-pro.lovable.app",
  ]) {
    assert.equal(h.isLovablePreviewHost(host), true, host);
    const r = h.securityHeadersFor(u(`https://${host}/`));
    assert.equal(r["X-Frame-Options"], undefined, host);
    assert.match(
      r["Content-Security-Policy"],
      /^frame-ancestors 'self' https:\/\/lovable\.dev/,
      host,
    );
  }
  for (const host of [
    "vibranding.lovable.app",
    "vibranding.pro",
    "evil-lovable.app",
    "lovable.app.evil.com",
    "localhost",
  ]) {
    assert.equal(h.isLovablePreviewHost(host), false, host);
  }
});

test("merge: no pisa cabeceras existentes y suma frame-ancestors a una CSP previa", () => {
  const url = u("https://vibranding.pro/p/abc");
  const merged = h.mergeSecurityHeaders(
    new Headers({
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'self'",
    }),
    url,
  );
  assert.equal(merged.get("Referrer-Policy"), "no-referrer");
  assert.equal(merged.get("Content-Security-Policy"), "default-src 'self'; frame-ancestors 'none'");
  assert.equal(merged.get("X-Frame-Options"), "DENY");
  const keep = h.mergeSecurityHeaders(
    new Headers({ "Content-Security-Policy": "frame-ancestors 'self'" }),
    url,
  );
  assert.equal(keep.get("Content-Security-Policy"), "frame-ancestors 'self'");
});

if (failures.length) {
  console.error(`\ncheck-security-headers: ${failures.length} fallo(s)`);
  process.exit(1);
}
console.log("\ncheck-security-headers: OK");
