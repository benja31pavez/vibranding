#!/usr/bin/env node
/**
 * Revisa las etapas por plan (src/lib/delivery/planStages.ts), el equipo
 * (src/lib/delivery/team.ts) y la salud de objetivos (src/lib/plan/objectives.ts).
 * Uso: node scripts/check-plan-stages.mjs  (o npm run check:plan-stages)
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "plan-stages-check-"));
const entry = join(outDir, "entry.ts");
const outFile = join(outDir, "planStages.mjs");
writeFileSync(
  entry,
  [
    `export * from ${JSON.stringify(join(root, "src/lib/delivery/planStages.ts"))};`,
    `export * from ${JSON.stringify(join(root, "src/lib/delivery/team.ts"))};`,
    `export * from ${JSON.stringify(join(root, "src/lib/plan/objectives.ts"))};`,
  ].join("\n"),
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

const failures = [];
const eq = (name, got, want) => {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${name}: esperaba ${b}, obtuvo ${a}`);
};
const keys = (plan) => plan.stages.map((x) => x.key);

// Plantillas por plan
const mant = s.resolvePlan("mantencion", []);
eq("mantención: 2 etapas", keys(mant), ["diseno", "planificacion"]);
eq("mantención: vista de personas", mant.view, "people");
eq(
  "mantención: responsables",
  mant.stages.map((x) => x.owner),
  ["antonia", "benjamin"],
);
eq("mantención con tilde", keys(s.resolvePlan("Mantención", [])), ["diseno", "planificacion"]);
eq("contenido", keys(s.resolvePlan("contenido", [])), [
  "estrategia",
  "diseno",
  "planificacion",
  "reporte",
]);
eq("crecimiento sin chatbot", keys(s.resolvePlan("crecimiento", [])), [
  "estrategia",
  "branding",
  "contenido",
  "ads",
  "landing",
  "optimizacion",
  "reporte",
]);
eq("crecimiento con chatbot en su lugar", keys(s.resolvePlan("crecimiento", ["chatbot"])), [
  "estrategia",
  "branding",
  "contenido",
  "ads",
  "landing",
  "chatbot",
  "optimizacion",
  "reporte",
]);
eq(
  "crecimiento: etiqueta Branding / Diseño",
  s.resolvePlan("crecimiento", []).stages[1].label,
  "Branding / Diseño",
);
eq("marca + web", keys(s.resolvePlan("marca-web", [])), ["branding", "landing", "entrega"]);
eq("marca + web: Landing / Web", s.resolvePlan("marca-web", []).stages[1].label, "Landing / Web");
eq("contenido + chatbot al final", keys(s.resolvePlan("contenido", ["chatbot"])).at(-1), "chatbot");
eq(
  "plan desconocido → completo",
  keys(s.resolvePlan("x", [])),
  keys(s.resolvePlan("crecimiento", [])),
);
eq("sin plan: etiqueta", s.resolvePlan(null, []).label, "Sin plan asignado");
eq("sin plan: clave null", s.resolvePlan(null, []).planKey, null);

// Equipo
eq(
  "equipo: Antonia diseñadora",
  [s.TEAM.antonia.name, s.TEAM.antonia.role],
  ["Antonia", "Diseñadora"],
);
eq("equipo: Benjamín estratega", s.TEAM.benjamin.role, "Publicista estratega");
eq("iniciales", [s.initials("Benjamín"), s.initials("Ana María Soto")], ["B", "AM"]);

// Títulos → etapa
eq("título Optimización", s.stageKeyFromTitle("Optimización"), "optimizacion");
eq("título Planificación", s.stageKeyFromTitle("Planificación de contenido"), "planificacion");
eq("título Landing Page", s.stageKeyFromTitle(" Landing Page "), "landing");
eq("entregable común no es etapa", s.stageKeyFromTitle("Post de lanzamiento"), null);

// Tareas → etapa (ajustada al plan)
const P = (k, a = []) => keys(s.resolvePlan(k, a));
eq("stage_key manda", s.taskStageKey({ title: "Logo", stage_key: "ads" }, P("crecimiento")), "ads");
eq(
  "marcador reel → contenido (crecimiento)",
  s.taskStageKey(
    { title: "Reel 1/4", description: "x\n\n[plan-mes:2026-10:reel-1]" },
    P("crecimiento"),
  ),
  "contenido",
);
eq(
  "marcador reel → diseño (mantención)",
  s.taskStageKey({ title: "Reel 1/2", description: "[plan-mes:2026-10:reel-1]" }, P("mantencion")),
  "diseno",
);
eq(
  "marcador calendario → planificación",
  s.taskStageKey(
    { title: "Calendario", description: "[plan-mes:2026-10:calendario]" },
    P("contenido"),
  ),
  "planificacion",
);
eq(
  "marcador google-business → entrega (marca + web)",
  s.taskStageKey({ title: "x", description: "[plan-mes:2026-10:google-business]" }, P("marca-web")),
  "entrega",
);
eq("palabra campaña", s.taskStageKey({ title: "Revisar campaña" }, P("crecimiento")), "ads");
eq(
  "ads fuera del plan → sin etapa",
  s.taskStageKey({ title: "Revisar campaña" }, P("contenido")),
  null,
);
eq("sin pista", s.taskStageKey({ title: "Llamar al cliente" }, P("contenido")), null);

// Tablero y entrega
eq("in_review = lista", s.taskColumn("in_review"), "done");
eq("in_progress = en curso", s.taskColumn("in_progress"), "doing");
eq("entrega: aprobada", s.deliveryState({ status: "done", approved_at: "2026-10-01" }), "approved");
eq(
  "entrega: entregada",
  s.deliveryState({ status: "done", delivered_at: "2026-10-01" }),
  "delivered",
);
eq("entrega: in_review", s.deliveryState({ status: "in_review" }), "delivered");
eq("entrega: interna", s.deliveryState({ status: "done" }), "done");
eq("entrega: abierta", s.deliveryState({ status: "pending" }), "open");

// Resumen
const plan = s.resolvePlan("contenido", []);
const rows = [
  { id: "r1", title: "Estrategia", status: "done", due_date: "2026-10-01", sort_order: 0 },
  { id: "r2", title: "Diseño", status: "pending", due_date: "2026-10-03", sort_order: 1 },
  { id: "r3", title: "Diseño", status: "done", due_date: null, sort_order: 9 },
];
const tasks = [
  {
    title: "Post 1/8",
    status: "done",
    due_date: "2026-10-03",
    description: "[plan-mes:2026-10:post-1]",
  },
  {
    title: "Reel 1/4",
    status: "in_progress",
    due_date: "2026-10-09",
    description: "[plan-mes:2026-10:reel-1]",
  },
  {
    title: "Calendario",
    status: "in_review",
    due_date: "2026-10-02",
    description: "[plan-mes:2026-10:calendario]",
  },
];
const sum = s.summarizeStages({ plan, rows, tasks, today: "2026-10-05" });
const by = Object.fromEntries(sum.map((x) => [x.key, x]));
eq(
  "resumen en orden del plan",
  sum.map((x) => x.key),
  keys(plan),
);
eq("estrategia lista por su fila", by.estrategia.status, "done");
eq("diseño usa la primera fila", by.diseno.rowId, "r2");
eq("diseño avance", [by.diseno.done, by.diseno.total, by.diseno.pct], [1, 2, 50]);
eq("diseño vencida", by.diseno.late, true);
eq(
  "planificación lista y entregada",
  [by.planificacion.status, by.planificacion.delivered],
  ["done", 1],
);
eq("reporte pendiente", by.reporte.status, "pending");

// General (todo el plan) y pastillas
const general = s.summarizePlan(sum);
eq(
  "general: avance total",
  [general.done, general.total],
  [sum.reduce((n, x) => n + x.done, 0), sum.reduce((n, x) => n + x.total, 0)],
);
eq("general atrasado si una etapa lo está", general.status, "late");
eq("pastilla atrasada", s.trackStatus("active", true), "late");
eq("pastilla lista nunca atrasada", s.trackStatus("done", true), "done");
const blank = s.summarizeStages({ plan, rows: [], tasks: [], today: "2026-10-05" });
eq("general sin empezar", s.summarizePlan(blank).status, "not_started");
eq("general sin fecha", s.summarizePlan(blank).nextDue, null);
const allDone = blank.map((x) => ({ ...x, status: "done", late: false }));
eq("general al día", s.summarizePlan(allDone).status, "on_track");
eq(
  "general próxima entrega = la más cercana sin terminar",
  s.summarizePlan([
    { ...blank[0], status: "active", dueDate: "2026-10-20" },
    { ...blank[1], status: "done", dueDate: "2026-10-08" },
    { ...blank[2], status: "pending", dueDate: "2026-10-12" },
  ]).nextDue,
  "2026-10-12",
);
eq("persona en curso", s.memberStatus([{ ...blank[0], status: "active" }, blank[1]]), "active");
eq("persona atrasada", s.memberStatus([{ ...blank[0], status: "active", late: true }]), "late");
const people = s.summarizeByOwner(
  s.summarizeStages({
    plan: s.resolvePlan("mantencion", []),
    rows: [],
    tasks,
    today: "2026-10-05",
  }),
);
eq(
  "mantención por persona",
  people.map((p) => [p.owner, p.done, p.total]),
  [
    ["antonia", 1, 2],
    ["benjamin", 1, 1],
  ],
);

// Objetivos
const obj = (o) => ({ status: "in_progress", target_value: 100, current_value: 0, ...o });
eq("objetivo logrado", s.objectiveHealth(obj({ current_value: 120 }), "2026-10-05"), "done");
eq(
  "objetivo vencido",
  s.objectiveHealth(obj({ current_value: 5, due_date: "2026-10-01" }), "2026-10-05"),
  "late",
);
eq("objetivo sin meta", s.objectiveHealth(obj({ target_value: null }), "2026-10-05"), "no_target");
eq(
  "objetivo en camino",
  s.objectiveHealth(
    obj({ current_value: 50, created_at: "2026-10-01", due_date: "2026-10-11" }),
    "2026-10-06",
  ),
  "on_track",
);
eq(
  "objetivo en riesgo",
  s.objectiveHealth(
    obj({ current_value: 10, created_at: "2026-10-01", due_date: "2026-10-11" }),
    "2026-10-08",
  ),
  "at_risk",
);

if (failures.length > 0) {
  console.error(`check-plan-stages: ${failures.length} fallo(s)`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("check-plan-stages: OK");
