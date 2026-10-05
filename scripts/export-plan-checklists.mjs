#!/usr/bin/env node
/**
 * Exporta las plantillas del plan (src/lib/delivery/planChecklists.ts) a un
 * Markdown legible para revisar la redacción: plan → etapa → tareas, y los
 * objetivos de cada plan. Los cambios se hacen después en planChecklists.ts.
 * Uso: node scripts/export-plan-checklists.mjs [salida.md]  (sin salida: stdout)
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "plan-checklists-md-"));
const entry = join(outDir, "entry.ts");
const outFile = join(outDir, "bundle.mjs");
writeFileSync(
  entry,
  ["planChecklists", "planStages", "team"]
    .map((m) => `export * from ${JSON.stringify(join(root, `src/lib/delivery/${m}.ts`))};`)
    .join("\n"),
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
const s = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const PLAN_ORDER = ["contenido", "crecimiento", "marca-web", "mantencion"];
const PLATFORM = { meta: "Meta", google: "Google Ads" };

const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

function taskLine(t) {
  const notes = [`responsable: ${s.TEAM[t.owner].name}`];
  if (t.signal) notes.push(`se detecta sola: ${lowerFirst(s.SIGNAL_LABELS[t.signal])}`);
  return `- ${t.title} _(${notes.join(" · ")})_`;
}

function planSection(planKey) {
  const addons = planKey === "crecimiento" ? ["chatbot"] : [];
  const plan = s.resolvePlan(planKey, addons);
  const tasks = s.checklistForPlan({ planKey, stages: plan.stages, adsPlatforms: null });
  const lines = [`## ${plan.label}`, ""];
  for (const stage of plan.stages) {
    const addon = planKey === "crecimiento" && stage.key === "chatbot" ? " (adicional)" : "";
    lines.push(`### ${stage.label}${addon}`, "");
    const own = tasks.filter((t) => t.stage === stage.key);
    for (const t of own) {
      const raw = s.STAGE_CHECKLISTS[stage.key].find((c) => c.key === t.key);
      const only = raw?.adsPlatform ? ` — solo si publicita en ${PLATFORM[raw.adsPlatform]}` : "";
      lines.push(taskLine(t) + only);
    }
    lines.push("");
  }
  lines.push("### Objetivos", "");
  for (const o of s.objectivesForPlan(planKey)) {
    const target =
      o.target === null ? "meta: se define con el cliente" : `meta: ${o.target} ${o.metric}`;
    lines.push(`- ${o.title} _(${target})_`);
  }
  lines.push("");
  return lines.join("\n");
}

const md = [
  "# Plantillas del plan (tareas y objetivos estándar)",
  "",
  "Se crean solas al abrir el Plan de un cliente (o al guardar su plan). Las que se",
  "detectan solas muestran «Detectado — revisar» y alguien las confirma; nunca se",
  "completan sin revisión. Para cambiar la redacción, responsables o metas, edita",
  "`src/lib/delivery/planChecklists.ts` (repo vibranding) y vuelve a exportar con",
  "`node scripts/export-plan-checklists.mjs <ruta>`.",
  "",
  ...PLAN_ORDER.map(planSection),
].join("\n");

const out = process.argv[2];
if (out) {
  writeFileSync(out, md);
  console.log(`export-plan-checklists: ${out}`);
} else {
  process.stdout.write(md);
}
