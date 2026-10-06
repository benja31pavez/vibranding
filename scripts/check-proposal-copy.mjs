#!/usr/bin/env node
/**
 * Revisa el copy de la propuesta pública (/p/$token).
 * Uso: node scripts/check-proposal-copy.mjs
 *
 * Reglas:
 *  - Nada de garantías ni reembolsos (sí se puede decir que NO hay devoluciones:
 *    decisión 2026-10-06, membresía sin devoluciones).
 *  - El chatbot de WhatsApp solo aparece como adicional con costo aparte.
 *  - Precios netos + IVA: nunca "IVA incluido"; la FAQ de pago explica que se suma IVA.
 *  - Mantención: sin pauta ni campañas incluidas.
 *  - Cada plan (PLANS en plans.ts) tiene al menos un ítem "No incluye", sin "garant".
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "proposal-copy-"));

await build({
  entryPoints: {
    content: join(root, "src/components/proposals/public/proposalContent.ts"),
    plans: join(root, "src/lib/pricing/plans.ts"),
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outdir: outDir,
  outExtension: { ".js": ".mjs" },
  alias: { "@": join(root, "src") },
  logLevel: "error",
});

const content = await import(pathToFileURL(join(outDir, "content.mjs")).href);
const { PLANS } = await import(pathToFileURL(join(outDir, "plans.mjs")).href);
rmSync(outDir, { recursive: true, force: true });

const PLAN_KEYS = ["marca-web", "contenido", "crecimiento", "mantencion", null];
const VAT_INCLUDED = /iva incluido|incluyen iva|incluye iva/i;
const FORBIDDEN = /garant|reembols|devoluci/i;
/** Negar devoluciones es obligatorio (no es una promesa): se quita antes de revisar. */
const NO_REFUND = /no hay devoluciones|sin devoluciones|no son reembolsables/gi;
const CHATBOT = /chatbot/i;
const ADDON = /adicional|costo aparte/i;

const failures = [];

for (const plan of PLANS) {
  const items = plan.notIncluded ?? [];
  if (items.length === 0) failures.push(`[${plan.key}] sin ítems en "No incluye" (notIncluded)`);
  for (const text of items) {
    if (/garant/i.test(text))
      failures.push(`[${plan.key}] "No incluye" menciona garantía: "${text}"`);
  }
  const fromProposal = content.planNotIncluded(plan.key);
  if (fromProposal.join("|") !== items.join("|")) {
    failures.push(`[${plan.key}] la propuesta no usa la lista "No incluye" de plans.ts`);
  }
}

for (const key of PLAN_KEYS) {
  const texts = [
    content.proposalOutcome(key),
    ...content.planFeatures(key),
    ...content.first30Days(key).flatMap((w) => [w.week, w.title, ...w.items]),
    ...[true, false].flatMap((monthly) =>
      content.proposalFaq(key, monthly).flatMap((f) => [f.q, f.a]),
    ),
    ...content.PROCESS_STEPS.flatMap((s) => [s.title, s.desc]),
    content.TIMELINE_NOTE,
  ];
  for (const text of texts) {
    if (FORBIDDEN.test(text.replace(NO_REFUND, "")))
      failures.push(`[${key}] garantía/reembolso: "${text}"`);
    if (VAT_INCLUDED.test(text)) failures.push(`[${key}] dice "IVA incluido": "${text}"`);
  }
  const pago = content.proposalFaq(key, true).find((f) => /cómo pago/i.test(f.q));
  if (!pago || !/netos/i.test(pago.a) || !/IVA/.test(pago.a)) {
    failures.push(`[${key}] la FAQ de pago no explica que los precios son netos + IVA`);
  }
  if (key === "mantencion") {
    for (const text of content.planFeatures(key)) {
      if (/meta ads|google ads|campañas/i.test(text) && !/^no /i.test(text)) {
        failures.push(`[mantencion] incluye campañas: "${text}"`);
      }
    }
    if (content.planFeatures(key).length === 0)
      failures.push("[mantencion] sin lista de qué incluye");
  }

  const outsideFaq = [
    ...content.planFeatures(key),
    ...content.first30Days(key).flatMap((w) => w.items),
  ];
  for (const text of outsideFaq) {
    if (CHATBOT.test(text)) failures.push(`[${key}] chatbot presentado como incluido: "${text}"`);
  }
  for (const f of content.proposalFaq(key, true)) {
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
