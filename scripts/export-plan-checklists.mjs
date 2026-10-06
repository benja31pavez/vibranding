#!/usr/bin/env node
/**
 * Exporta las plantillas del plan a un Markdown legible para revisar la
 * redacción: por plan, las tareas de inicio (planChecklists.ts, con día y
 * responsable), el ciclo mensual (planCycle.ts) y los objetivos. Los cambios
 * se hacen después en esos archivos.
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
  ["planChecklists", "planCycle", "planStages", "team"]
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
  const notes = [t.day ? `día ${t.day}` : "sin fecha fija", `responsable: ${s.TEAM[t.owner].name}`];
  if (t.signal) notes.push(`se detecta sola: ${lowerFirst(s.SIGNAL_LABELS[t.signal])}`);
  return `- ${t.title} _(${notes.join(" · ")})_`;
}

function planSection(planKey) {
  const addons = planKey === "crecimiento" ? ["chatbot"] : [];
  const plan = s.resolvePlan(planKey, addons);
  const tasks = s.checklistForPlan({ planKey, stages: plan.stages, adsPlatforms: null });
  const lines = [`## ${plan.label}`, "", "### Inicio (una sola vez, al asignar el plan)", ""];
  for (const stage of plan.stages) {
    const addon = planKey === "crecimiento" && stage.key === "chatbot" ? " (adicional)" : "";
    const own = tasks.filter((t) => t.stage === stage.key);
    if (own.length === 0) continue;
    lines.push(`#### ${stage.label}${addon}`, "");
    for (const t of own) {
      const raw = s.STAGE_CHECKLISTS[stage.key].find((c) => c.key === t.key);
      const only = raw?.adsPlatform ? ` — solo si publicita en ${PLATFORM[raw.adsPlatform]}` : "";
      lines.push(taskLine(t) + only);
    }
    lines.push("");
  }
  lines.push(...cycleSection(planKey, plan));
  lines.push("### Objetivos", "");
  for (const o of s.objectivesForPlan(planKey)) {
    const target = o.target === null ? "sin meta numérica" : `meta: ${o.target} ${o.metric}`;
    lines.push(`- ${o.title} _(${target})_`);
  }
  lines.push("");
  return lines.join("\n");
}

const WEEK_LABELS = {
  1: "Semana 1",
  2: "Semana 2",
  3: "Semana 3",
  cierre: "Cierre (mes siguiente)",
};

function cycleSection(planKey, plan) {
  const own = s.CYCLE_TASKS.filter((t) => t.stages[planKey]);
  if (own.length === 0) return [];
  const stageLabel = (key) => plan.stages.find((st) => st.key === key)?.label ?? key;
  const lines = ["### Ciclo mensual (cada mes)", ""];
  for (const week of [1, 2, 3, "cierre"]) {
    const items = own.filter((t) => t.week === week);
    if (items.length === 0) continue;
    lines.push(`#### ${WEEK_LABELS[week]}`, "");
    for (const t of items) {
      const title = (t.titleByPlan?.[planKey] ?? t.title).replace("{mes}", "<mes>");
      const when = t.weekly
        ? "cada lunes"
        : `día ${t.day}${t.nextMonth ? " del mes siguiente" : ""}`;
      const notes = [
        when,
        `responsable: ${s.TEAM[t.owner].name}`,
        `etapa: ${stageLabel(t.stages[planKey])}`,
      ];
      if (t.signal) notes.push(`se detecta sola: ${lowerFirst(s.SIGNAL_LABELS[t.signal])}`);
      lines.push(`- ${title} _(${notes.join(" · ")})_`);
    }
    lines.push("");
  }
  return lines;
}

const md = [
  "# Plantillas del plan (tareas y objetivos estándar)",
  "",
  "Se crean solas al asignar el plan o al abrir el Plan de un cliente. Las de inicio",
  "van una sola vez, con fecha desde el día de inicio del cliente; las del ciclo se",
  "crean cada mes (el día 25 se crea el mes siguiente). Las fechas que caen en fin de",
  "semana o feriado pasan al siguiente día hábil. Las que se detectan solas muestran",
  "«Detectado — revisar» y alguien las confirma; nunca se completan sin revisión.",
  "Para cambiar la redacción, días, responsables o metas, edita",
  "`src/lib/delivery/planChecklists.ts` y `planCycle.ts` (repo vibranding) y vuelve a",
  "exportar con `node scripts/export-plan-checklists.mjs <ruta>`.",
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
