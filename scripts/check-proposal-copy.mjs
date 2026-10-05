#!/usr/bin/env node
/**
 * Revisa el copy de la propuesta pública (/p/$token).
 * Uso: node scripts/check-proposal-copy.mjs
 *
 * Reglas:
 *  - Nada de garantías ni reembolsos.
 *  - El chatbot de WhatsApp solo aparece como adicional con costo aparte.
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "proposal-copy-"));
const outFile = join(outDir, "content.mjs");

await build({
  entryPoints: [join(root, "src/components/proposals/public/proposalContent.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  alias: { "@": join(root, "src") },
  logLevel: "error",
});

const content = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const PLAN_KEYS = ["marca-web", "contenido", "crecimiento", null];
const FORBIDDEN = /garant|reembols|devoluci/i;
const CHATBOT = /chatbot/i;
const ADDON = /adicional|costo aparte/i;

const failures = [];

for (const key of PLAN_KEYS) {
  const texts = [
    content.proposalOutcome(key),
    ...content.planFeatures(key),
    ...content.first30Days(key).flatMap((w) => [w.week, w.title, ...w.items]),
    ...[true, false].flatMap((monthly) =>
      content.proposalFaq(key, monthly, 3).flatMap((f) => [f.q, f.a]),
    ),
    ...content.PROCESS_STEPS.flatMap((s) => [s.title, s.desc]),
    content.TIMELINE_NOTE,
  ];
  for (const text of texts) {
    if (FORBIDDEN.test(text)) failures.push(`[${key}] garantía/reembolso: "${text}"`);
  }

  const outsideFaq = [
    ...content.planFeatures(key),
    ...content.first30Days(key).flatMap((w) => w.items),
  ];
  for (const text of outsideFaq) {
    if (CHATBOT.test(text)) failures.push(`[${key}] chatbot presentado como incluido: "${text}"`);
  }
  for (const f of content.proposalFaq(key, true, 3)) {
    if (CHATBOT.test(f.q + f.a) && !ADDON.test(f.a)) {
      failures.push(`[${key}] chatbot sin aclarar que es adicional: "${f.a}"`);
    }
  }
}

if (failures.length > 0) {
  console.error(`check-proposal-copy: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-proposal-copy: OK");
