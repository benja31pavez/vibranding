#!/usr/bin/env node
/**
 * Revisa las plantillas del plan (src/lib/delivery/planChecklists.ts), la
 * siembra idempotente (planTemplateSeed.ts) y las señales de la plataforma
 * (planSignals.ts).
 * Uso: node scripts/check-plan-checklists.mjs  (o npm run check:plan-checklists)
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "plan-checklists-check-"));
const entry = join(outDir, "entry.ts");
const outFile = join(outDir, "planChecklists.mjs");
writeFileSync(
  entry,
  ["planChecklists", "planSignals", "planTemplateSeed", "planStages"]
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

const failures = [];
const eq = (name, got, want) => {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${name}: esperaba ${b}, obtuvo ${a}`);
};
const ok = (name, cond) => {
  if (!cond) failures.push(name);
};

const PLAN_KEYS = ["mantencion", "contenido", "crecimiento", "marca-web"];
const KEY_RE = /^[a-z0-9-]+$/;
const TITLE_MAX = 200;

// ─── Catálogo ───────────────────────────────────────────────────────────────
for (const stage of s.STAGE_KEYS) {
  const tasks = s.STAGE_CHECKLISTS[stage];
  ok(`etapa ${stage} sin tareas`, tasks && tasks.length > 0);
  const keys = tasks.map((t) => t.key);
  eq(`claves únicas en ${stage}`, new Set(keys).size, keys.length);
  for (const t of tasks) {
    ok(`clave inválida ${stage}:${t.key}`, KEY_RE.test(t.key));
    ok(`título vacío/largo ${stage}:${t.key}`, t.title.trim() && t.title.length <= TITLE_MAX);
    ok(`señal desconocida ${stage}:${t.key}`, !t.signal || s.PLAN_SIGNALS.includes(t.signal));
    ok(
      `plan desconocido ${stage}:${t.key}`,
      (t.plans ?? []).every((p) => PLAN_KEYS.includes(p)),
    );
  }
}
for (const signal of s.PLAN_SIGNALS) ok(`señal sin texto ${signal}`, s.SIGNAL_LABELS[signal]);
for (const plan of PLAN_KEYS) {
  const objs = s.PLAN_OBJECTIVES[plan];
  ok(`plan ${plan} sin objetivos`, objs && objs.length > 0);
  eq(`objetivos únicos en ${plan}`, new Set(objs.map((o) => o.key)).size, objs.length);
  for (const o of objs) {
    ok(`clave de objetivo inválida ${plan}:${o.key}`, KEY_RE.test(o.key));
    ok(`meta inválida ${plan}:${o.key}`, o.target === null || o.target > 0);
  }
}

// ─── Selección por cliente ──────────────────────────────────────────────────
const ctx = (planKey, addons = [], adsPlatforms = null) => ({
  planKey,
  stages: s.resolvePlan(planKey, addons).stages,
  adsPlatforms,
});
const keysOf = (list) => list.map((t) => t.itemKey);

const crec = s.checklistForPlan(ctx("crecimiento"));
ok("crecimiento: logo en branding", keysOf(crec).includes("tarea:branding:logo"));
ok("crecimiento sin chatbot", !crec.some((t) => t.stage === "chatbot"));
ok(
  "crecimiento con chatbot",
  s.checklistForPlan(ctx("crecimiento", ["chatbot"])).some((t) => t.stage === "chatbot"),
);
ok(
  "sin respuesta de pauta: ambas cuentas",
  ["tarea:ads:cuenta-meta", "tarea:ads:cuenta-google"].every((k) => keysOf(crec).includes(k)),
);
const soloMeta = keysOf(s.checklistForPlan(ctx("crecimiento", [], ["meta"])));
ok("solo Meta: sin cuenta de Google", !soloMeta.includes("tarea:ads:cuenta-google"));
ok("solo Meta: con cuenta de Meta", soloMeta.includes("tarea:ads:cuenta-meta"));
eq("responsable del logo", crec.find((t) => t.key === "logo").owner, "antonia");
eq(
  "responsable de la cuenta Meta (de la etapa)",
  crec.find((t) => t.key === "cuenta-meta").owner,
  "benjamin",
);

const mant = s.checklistForPlan(ctx("mantencion"));
eq(
  "mantención: piezas",
  mant.find((t) => t.itemKey === "tarea:diseno:piezas").title,
  "8 piezas del mes diseñadas",
);
ok("mantención: reporte en planificación", keysOf(mant).includes("tarea:planificacion:reporte"));
const cont = s.checklistForPlan(ctx("contenido"));
ok(
  "contenido: sin reporte en planificación",
  !keysOf(cont).includes("tarea:planificacion:reporte"),
);
eq(
  "contenido: piezas",
  cont.find((t) => t.itemKey === "tarea:diseno:piezas").title,
  "12 piezas del mes diseñadas",
);
eq("sin plan: nada", s.checklistForPlan({ ...ctx("crecimiento"), planKey: null }).length, 0);
eq("objetivos sin plan", s.objectivesForPlan(null).length, 0);
eq("objetivo mantención", s.objectivesForPlan("mantencion")[0].target, 8);
eq(
  "objetivo template_key",
  s.objectivesForPlan("crecimiento")[0].itemKey,
  "objetivo:crecimiento:leads-whatsapp",
);

// ─── Marcador ───────────────────────────────────────────────────────────────
eq("marcador", s.templateMarker("branding", "logo"), "[plantilla:branding:logo]");
eq("leer marcador", s.readTemplateMarker(s.templateDescription("ads", "pago")), {
  stage: "ads",
  key: "pago",
});
eq("sin marcador", s.readTemplateMarker("texto libre"), null);
eq(
  "etapa por marcador de plantilla",
  s.taskStageKey({ title: "Algo", description: "[plantilla:ads:pago]" }, ["ads", "reporte"]),
  "ads",
);

// ─── Siembra idempotente ────────────────────────────────────────────────────
const asTasks = (planned) =>
  planned.map((t) => ({ description: s.templateDescription(t.stage, t.key) }));
const asObjectives = (planned, withKey = true) =>
  planned.map((o) => ({ title: o.title, template_key: withKey ? o.itemKey : undefined }));

const c = ctx("crecimiento");
const first = s.planSeed({ ctx: c, tasks: [], objectives: [], ledger: new Set() });
eq("primera siembra: todas las tareas", first.tasks.length, crec.length);
eq("primera siembra: objetivos", first.objectives.length, s.PLAN_OBJECTIVES.crecimiento.length);
const ledger = new Set(first.ledgerAdd);
const again = s.planSeed({
  ctx: c,
  tasks: asTasks(first.tasks),
  objectives: asObjectives(first.objectives),
  ledger,
});
eq(
  "segunda siembra: nada",
  [again.tasks.length, again.objectives.length, again.ledgerAdd.length],
  [0, 0, 0],
);

const withoutLogo = asTasks(first.tasks.filter((t) => t.key !== "logo"));
eq(
  "borrada con registro: no vuelve",
  s.planSeed({ ctx: c, tasks: withoutLogo, objectives: asObjectives(first.objectives), ledger })
    .tasks.length,
  0,
);
eq(
  "borrada sin registro (etapa ya sembrada): no vuelve",
  s.planSeed({
    ctx: c,
    tasks: withoutLogo,
    objectives: asObjectives(first.objectives),
    ledger: new Set(),
  }).tasks.length,
  0,
);
const objsByTitle = s.planSeed({
  ctx: c,
  tasks: asTasks(first.tasks),
  objectives: asObjectives(first.objectives, false),
  ledger: new Set(),
});
eq("objetivos por título (sin migración): sin duplicar", objsByTitle.objectives.length, 0);

const chat = ctx("crecimiento", ["chatbot"]);
const planChange = s.planSeed({
  ctx: chat,
  tasks: asTasks(first.tasks),
  objectives: asObjectives(first.objectives),
  ledger,
});
eq(
  "adicional nuevo: solo las tareas del chatbot",
  planChange.tasks.map((t) => t.stage),
  s.STAGE_CHECKLISTS.chatbot.map(() => "chatbot"),
);

const mantCtx = ctx("mantencion");
const toMant = s.planSeed({
  ctx: mantCtx,
  tasks: asTasks(first.tasks),
  objectives: asObjectives(first.objectives),
  ledger,
});
ok(
  "cambio a Mantención: agrega diseño/planificación",
  toMant.tasks.length > 0 &&
    toMant.tasks.every((t) => ["diseno", "planificacion"].includes(t.stage)),
);
ok("cambio de plan: nunca borra", !("remove" in toMant) && !("delete" in toMant));

const userTask = [{ description: "Tarea creada a mano" }];
eq(
  "tareas a mano no cuentan como plantilla",
  s.planSeed({ ctx: c, tasks: userTask, objectives: [], ledger: new Set() }).tasks.length,
  crec.length,
);
ok("isTemplateTask", s.isTemplateTask({ description: "x [plantilla:reporte:generado]" }));
ok(
  "isTemplateObjective por título",
  s.isTemplateObjective({ title: "publicar 12 piezas al MES" }, s.objectivesForPlan("contenido")),
);

// ─── Señales ────────────────────────────────────────────────────────────────
ok("logo png", s.hasLogoFile(["abc/123-Logo-final.png"]));
ok("logo en carpeta no cuenta", !s.hasLogoFile(["logos/foto-local.png"]));
ok("isotipo svg", s.hasLogoFile(["x/isotipo.svg"]));
eq("mes anterior", s.previousMonthStart("2026-01-15"), "2025-12-01");

const snap = {
  intake: { publicoObjetivo: " ", colores: ["#ff0000"], archivos: ["c/logo.png"] },
  metaLinked: true,
  googleLinked: false,
  adsBilling: ["verificado", "sin_cuenta"],
  landings: [{ published: true, slug: "cliente", whatsappEnabled: true, contactEnabled: false }],
  multilinks: [{ published: false }],
  reports: [
    { period: "2026-08-01", sentAt: "2026-09-02T10:00:00Z" },
    { period: "2026-09-01", sentAt: null },
  ],
  today: "2026-10-05",
};
const sig = s.detectSignals(snap);
eq("señales detectadas", [...sig].sort(), [
  "ads_billing_verified",
  "brand_colors",
  "client_files",
  "intake_submitted",
  "landing_published",
  "landing_url",
  "logo_file",
  "meta_linked",
  "report_generated",
]);
eq(
  "sin onboarding: sin señales de onboarding",
  s.detectSignals({ ...snap, intake: null }).has("intake_submitted"),
  false,
);
eq(
  "tarea abierta con señal",
  s.detectedSignal({ status: "pending", description: "[plantilla:branding:logo]" }, sig),
  "logo_file",
);
eq(
  "tarea lista: sin badge (nunca se completa sola)",
  s.detectedSignal({ status: "done", description: "[plantilla:branding:logo]" }, sig),
  null,
);
eq(
  "señal no cumplida",
  s.detectedSignal({ status: "pending", description: "[plantilla:ads:cuenta-google]" }, sig),
  null,
);
eq("tarea sin plantilla", s.detectedSignal({ status: "pending", description: null }, sig), null);

if (failures.length > 0) {
  console.error(`check-plan-checklists: ${failures.length} fallo(s)`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("check-plan-checklists: OK");
