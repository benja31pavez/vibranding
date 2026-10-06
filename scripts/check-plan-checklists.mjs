#!/usr/bin/env node
/**
 * Revisa las plantillas del plan (src/lib/delivery/planChecklists.ts), el
 * ciclo mensual (planCycle.ts), la siembra idempotente (planTemplateSeed.ts)
 * y las señales de la plataforma (planSignals.ts).
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
  ["planChecklists", "planCycle", "planSignals", "planTemplateSeed", "planStages", "monthPlan"]
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
const cycleStages = new Set(s.CYCLE_TASKS.flatMap((t) => Object.values(t.stages)));
for (const stage of s.STAGE_KEYS) {
  const tasks = s.STAGE_CHECKLISTS[stage];
  ok(
    `etapa ${stage} sin tareas de inicio ni del ciclo`,
    tasks.length > 0 || cycleStages.has(stage),
  );
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
    ok(`día inválido ${stage}:${t.key}`, t.day === undefined || (t.day >= 1 && t.day <= 31));
  }
}
for (const signal of s.PLAN_SIGNALS) ok(`señal sin texto ${signal}`, s.SIGNAL_LABELS[signal]);
const BANNED_OBJECTIVE = /(leads?|costo por|cpl|ctr|seguidores|interacci|crecimiento de|%)/i;
for (const plan of PLAN_KEYS) {
  const objs = s.PLAN_OBJECTIVES[plan];
  ok(`plan ${plan} sin objetivos`, objs && objs.length > 0);
  eq(`objetivos únicos en ${plan}`, new Set(objs.map((o) => o.key)).size, objs.length);
  for (const o of objs) {
    ok(`clave de objetivo inválida ${plan}:${o.key}`, KEY_RE.test(o.key));
    ok(`meta inválida ${plan}:${o.key}`, o.target === null || o.target > 0);
    ok(`objetivo de resultado (no entregable) ${plan}:${o.key}`, !BANNED_OBJECTIVE.test(o.title));
    ok(`unidad "horas hábiles" ${plan}:${o.key}`, !/hábiles/.test(o.metric));
    ok(`plazo de 72 h ${plan}:${o.key}`, !/72/.test(o.title));
  }
}
eq(
  "objetivos de contenido",
  s.PLAN_OBJECTIVES.contenido.map((o) => o.title),
  [
    "Publicar 12 piezas al mes",
    "Calendario del mes aprobado",
    "Aprobación del cliente en ≤48 h",
    "Reporte del mes enviado antes del día 5",
  ],
);
eq(
  "anuncios de crecimiento",
  s.PLAN_OBJECTIVES.crecimiento.find((o) => o.key === "anuncios-mes").target,
  4,
);

// ─── Tareas de inicio por plan ──────────────────────────────────────────────
const ctx = (planKey, addons = [], adsPlatforms = null) => ({
  planKey,
  stages: s.resolvePlan(planKey, addons).stages,
  adsPlatforms,
});
const keysOf = (list) => list.map((t) => t.itemKey);
const dated = (list) => list.filter((t) => t.day !== null);
const byKey = (list, key) => list.find((t) => t.itemKey === key);

const crec = s.checklistForPlan(ctx("crecimiento"));
const cont = s.checklistForPlan(ctx("contenido"));
const mw = s.checklistForPlan(ctx("marca-web"));
const mant = s.checklistForPlan(ctx("mantencion"));

const COMMON = [
  ["Reunión de inicio y brief", "benjamin", 1],
  ["Público objetivo y propuesta de valor", "benjamin", 3],
  ["Accesos de Instagram, Meta y Google", "benjamin", 3],
  ["Logo en PNG y SVG", "antonia", 5],
  ["Paleta y tipografías", "antonia", 5],
  ["Bio, destacadas y link de Instagram", "antonia", 7],
  ["Ficha de Google Business revisada", "benjamin", 7],
];
const asRows = (list) =>
  dated(list)
    .map((t) => [t.title, t.owner, t.day])
    .sort((a, b) => a[2] - b[2] || a[0].localeCompare(b[0]));
const sortRows = (rows) => [...rows].sort((a, b) => a[2] - b[2] || a[0].localeCompare(b[0]));
eq("inicio de contenido", asRows(cont), sortRows(COMMON));
eq(
  "inicio de crecimiento",
  asRows(crec.filter((t) => t.stage !== "landing")),
  sortRows([
    ...COMMON,
    ["Medio de pago de la pauta verificado", "benjamin", 5],
    ["Píxel y conversiones configurados", "benjamin", 7],
    ["Público y presupuesto aprobados", "benjamin", 7],
  ]),
);
eq(
  "inicio de marca-web",
  asRows(mw),
  sortRows([
    ["Reunión de inicio y brief", "benjamin", 1],
    ["Propuesta de logo con 2 opciones", "antonia", 5],
    ["Ajustes de logo", "antonia", 8],
    ["Kit de marca entregado", "antonia", 10],
    ["Borrador de landing", "benjamin", 12],
    ["Revisión del cliente", "benjamin", 14],
    ["Landing publicada y probada", "benjamin", 16],
    ["Ficha de Google Business", "benjamin", 18],
    ["Entrega final y confirmación", "benjamin", 21],
  ]),
);
eq("marca-web: todas con fecha", mw.length, dated(mw).length);
eq("crecimiento: todas con fecha", crec.length, dated(crec).length);
const withChat = s.checklistForPlan(ctx("crecimiento", ["chatbot"]));
eq("crecimiento + chatbot: todas con fecha", withChat.length, dated(withChat).length);
eq(
  "landing en crecimiento",
  crec.filter((t) => t.stage === "landing").map((t) => [t.title, t.owner, t.day]),
  [
    ["Textos y fotos recibidos", "benjamin", 7],
    ["Dominio o URL definida", "benjamin", 10],
    ["Landing publicada", "benjamin", 14],
    ["Botón de WhatsApp y formulario probados", "benjamin", 15],
  ],
);
eq(
  "chatbot (adicional)",
  withChat.filter((t) => t.stage === "chatbot").map((t) => [t.title, t.owner, t.day]),
  [
    ["Preguntas frecuentes recopiladas", "benjamin", 7],
    ["Flujo aprobado", "benjamin", 10],
    ["Número de WhatsApp conectado", "benjamin", 12],
    ["Prueba completa", "benjamin", 14],
  ],
);
eq("inicio de mantención", asRows(mant), [["Accesos de Instagram vigentes", "benjamin", 1]]);
eq("mantención: solo accesos", mant.length, 1);
ok("señal del brief", byKey(crec, "tarea:estrategia:brief").signal === "intake_submitted");
ok("señal del logo (contenido)", byKey(cont, "tarea:diseno:logo").signal === "logo_file");
ok("señal del logo (crecimiento)", byKey(crec, "tarea:branding:logo").signal === "logo_file");
ok("señal de colores", byKey(crec, "tarea:branding:paleta").signal === "brand_colors");
ok("señal del pago de pauta", byKey(crec, "tarea:ads:pago").signal === "ads_billing_verified");
ok("señal de la landing (marca-web)", byKey(mw, "tarea:landing:publicada").signal !== null);
ok("crecimiento sin chatbot", !crec.some((t) => t.stage === "chatbot"));
ok(
  "crecimiento con chatbot",
  s.checklistForPlan(ctx("crecimiento", ["chatbot"])).some((t) => t.stage === "chatbot"),
);
ok("contenido sin tareas recurrentes en inicio", !keysOf(cont).includes("tarea:diseno:piezas"));
eq("sin plan: nada", s.checklistForPlan({ ...ctx("crecimiento"), planKey: null }).length, 0);
eq("objetivos sin plan", s.objectivesForPlan(null).length, 0);
eq("objetivo mantención", s.objectivesForPlan("mantencion")[0].target, 8);
eq(
  "objetivo template_key",
  s.objectivesForPlan("crecimiento")[0].itemKey,
  "objetivo:crecimiento:piezas-mes",
);

// ─── Fechas de inicio ───────────────────────────────────────────────────────
// 2026-10-05 es lunes. Día 5 = vie 9; día 7 = dom 11 → lun 12 es feriado → mar 13.
eq("día 1 = inicio", s.onboardingDueDate("2026-10-05", 1), "2026-10-05");
eq("día 5", s.onboardingDueDate("2026-10-05", 5), "2026-10-09");
eq("día 7 (domingo + feriado) → martes", s.onboardingDueDate("2026-10-05", 7), "2026-10-13");
eq("sin día: sin fecha", s.onboardingDueDate("2026-10-05", null), null);
eq("base: inicio reciente", s.onboardingBase("2026-09-20", "2026-10-06"), "2026-09-20");
eq("base: inicio futuro", s.onboardingBase("2026-10-15", "2026-10-06"), "2026-10-15");
eq("base: inicio antiguo → hoy", s.onboardingBase("2026-01-10", "2026-10-06"), "2026-10-06");
eq("base: sin inicio → hoy", s.onboardingBase(null, "2026-10-06"), "2026-10-06");

// ─── Ciclo mensual ──────────────────────────────────────────────────────────
eq("planes con ciclo", [...s.CYCLE_PLANS], ["contenido", "crecimiento", "mantencion"]);
eq("marca-web sin ciclo", s.cycleForPlan("marca-web", "2026-11").length, 0);
eq("sin plan sin ciclo", s.cycleForPlan(null, "2026-11").length, 0);
eq("mes inválido", s.cycleForPlan("contenido", "2026-13").length, 0);
for (const t of s.CYCLE_TASKS) {
  ok(`clave de ciclo inválida ${t.key}`, KEY_RE.test(t.key));
  ok(`señal desconocida (ciclo) ${t.key}`, !t.signal || s.PLAN_SIGNALS.includes(t.signal));
  for (const [plan, stage] of Object.entries(t.stages)) {
    ok(
      `etapa ${stage} de ${t.key} no está en el plan ${plan}`,
      s.resolvePlan(plan, []).stages.some((st) => st.key === stage),
    );
  }
}
eq("claves de ciclo únicas", new Set(s.CYCLE_TASKS.map((t) => t.key)).size, s.CYCLE_TASKS.length);

const nov = (plan) => s.cycleForPlan(plan, "2026-11");
const row = (list, key) => {
  const t = list.find((x) => x.key === key);
  return t ? [t.title, t.owner, t.dueDate, t.stage] : null;
};
// Noviembre 2026: 1 dom (feriado), 3 mar, 5 jue, 8 dom, 10 mar, 12 jue, 13 vie, 15 dom.
const contNov = nov("contenido");
eq("contenido: calendario", row(contNov, "calendario"), [
  "Calendario de noviembre",
  "benjamin",
  "2026-11-03",
  "planificacion",
]);
eq("contenido: copys", row(contNov, "copys")[2], "2026-11-05");
eq("contenido: piezas", row(contNov, "piezas"), [
  "12 piezas de noviembre diseñadas",
  "antonia",
  "2026-11-10",
  "diseno",
]);
eq("contenido: envío a aprobación", row(contNov, "envio-aprobacion")[2], "2026-11-10");
eq("contenido: aprobación", row(contNov, "aprobacion")[2], "2026-11-12");
eq("contenido: programar", row(contNov, "programar")[2], "2026-11-13");
eq("contenido: reporte (1 dic, martes)", row(contNov, "reporte")[2], "2026-12-01");
eq("contenido: reporte enviado (3 dic)", row(contNov, "reporte-enviado")[2], "2026-12-03");
eq("contenido: sin anuncios", row(contNov, "anuncios"), null);
eq("contenido: tareas", contNov.length, 8);

const crecNov = nov("crecimiento");
eq("crecimiento: anuncios (8 nov domingo → lun 9)", row(crecNov, "anuncios"), [
  "Anuncios nuevos de noviembre",
  "antonia",
  "2026-11-09",
  "ads",
]);
eq(
  "crecimiento: ajuste de presupuesto (15 nov domingo → lun 16)",
  row(crecNov, "presupuesto")[2],
  "2026-11-16",
);
eq("crecimiento: pago de pauta", row(crecNov, "pago-pauta")[2], "2026-12-01");
eq("crecimiento: piezas en Contenido", row(crecNov, "piezas")[3], "contenido");
const reviews = crecNov.filter((t) => t.key.startsWith("revision-campanas-"));
eq(
  "crecimiento: revisión cada lunes de noviembre",
  reviews.map((t) => t.dueDate),
  ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"],
);
eq(
  "lunes feriado → martes (12 oct 2026)",
  s
    .cycleForPlan("crecimiento", "2026-10")
    .filter((t) => t.key.startsWith("revision-campanas-"))
    .map((t) => t.dueDate),
  ["2026-10-05", "2026-10-13", "2026-10-19", "2026-10-26"],
);

const mantNov = nov("mantencion");
eq("mantención: solo calendario, piezas, programar y reporte", mantNov.map((t) => t.key).sort(), [
  "calendario",
  "piezas",
  "programar",
  "reporte",
]);
eq("mantención: 8 piezas", row(mantNov, "piezas")[0], "8 piezas de noviembre diseñadas");
eq("mantención: reporte en planificación", row(mantNov, "reporte")[3], "planificacion");

eq("meses: antes del 25", s.cycleMonths("2026-10-24"), ["2026-10"]);
eq("meses: desde el 25", s.cycleMonths("2026-10-25"), ["2026-10", "2026-11"]);
eq("meses: diciembre → enero", s.cycleMonths("2026-12-28"), ["2026-12", "2027-01"]);
eq("día 31 en febrero se acota", s.cycleDate("2027-02", 31), "2027-03-01");

// Claves por mes: estables, únicas y con el mes.
const allKeys = [...contNov, ...crecNov, ...mantNov].map((t) => t.itemKey);
ok(
  "clave con mes",
  allKeys.every((k) => /^ciclo:[a-z0-9-]+:\d{4}-\d{2}$/.test(k)),
);
eq("claves únicas por plan y mes", new Set(keysOf(crecNov)).size, crecNov.length);
ok(
  "otro mes, otras claves",
  keysOf(s.cycleForPlan("contenido", "2026-12")).every((k) => !keysOf(contNov).includes(k)),
);
eq(
  "marcador del ciclo",
  s.cycleMarker("planificacion", "calendario", "2026-11"),
  "[plantilla:planificacion:calendario:2026-11]",
);
eq(
  "leer marcador del ciclo",
  s.readTemplateMarker(s.cycleDescription("ads", "revision-campanas-2", "2026-11")),
  { stage: "ads", key: "revision-campanas-2", month: "2026-11" },
);

// Idempotencia del ciclo por cliente + mes.
const cyc = (over = {}) =>
  s.cycleSeed({
    planKey: "contenido",
    months: ["2026-11"],
    present: new Set(),
    ledger: new Set(),
    clientStart: null,
    ...over,
  });
const firstCycle = cyc();
eq("ciclo: primera vez, todo", firstCycle.tasks.length, contNov.length);
const asCycleTasks = (list) =>
  list.map((t) => ({ description: s.cycleDescription(t.stage, t.key, t.month) }));
const presentNov = s.presentCycleKeys(asCycleTasks(firstCycle.tasks));
eq("ciclo: segunda vez, nada", cyc({ present: presentNov }).tasks.length, 0);
eq(
  "ciclo: borrada con registro no vuelve",
  cyc({ ledger: new Set(firstCycle.ledgerAdd) }).tasks.length,
  0,
);
eq(
  "ciclo: cambio de plan no repite el mes",
  s
    .cycleSeed({
      planKey: "crecimiento",
      months: ["2026-11"],
      present: presentNov,
      ledger: new Set(firstCycle.ledgerAdd),
      clientStart: null,
    })
    .tasks.map((t) => t.key)
    .includes("calendario"),
  false,
);
eq(
  "ciclo: lo anterior al inicio del cliente no se crea",
  cyc({ clientStart: "2026-11-11" }).tasks.map((t) => t.key),
  ["aprobacion", "programar", "reporte", "reporte-enviado"],
);
eq("ciclo: dos meses", cyc({ months: ["2026-11", "2026-12"] }).tasks.length, contNov.length * 2);
eq("ciclo: marca-web nada", cyc({ planKey: "marca-web" }).tasks.length, 0);
eq(
  "ciclo: tareas de inicio no cuentan como ciclo",
  s.presentCycleKeys([{ description: "[plantilla:estrategia:brief]" }]).size,
  0,
);

// ─── Marcador de inicio ─────────────────────────────────────────────────────
eq("marcador", s.templateMarker("branding", "logo"), "[plantilla:branding:logo]");
eq("leer marcador", s.readTemplateMarker(s.templateDescription("ads", "pago")), {
  stage: "ads",
  key: "pago",
  month: null,
});
eq("sin marcador", s.readTemplateMarker("texto libre"), null);
eq(
  "etapa por marcador de plantilla",
  s.taskStageKey({ title: "Algo", description: "[plantilla:ads:pago]" }, ["ads", "reporte"]),
  "ads",
);
eq(
  "etapa por marcador del ciclo",
  s.taskStageKey({ title: "Algo", description: "[plantilla:reporte:reporte:2026-10]" }, [
    "estrategia",
    "reporte",
  ]),
  "reporte",
);

// ─── Siembra completa (inicio + ciclo + objetivos) ──────────────────────────
const TODAY = "2026-10-06";
const seed = (over) =>
  s.planSeed({
    ctx: ctx("crecimiento"),
    tasks: [],
    objectives: [],
    ledger: new Set(),
    today: TODAY,
    clientStart: TODAY,
    cycleActive: true,
    ...over,
  });
const asTasks = (list) => list.map((t) => ({ description: t.description }));
const asObjectives = (planned, withKey = true) =>
  planned.map((o) => ({ title: o.title, template_key: withKey ? o.itemKey : undefined }));

const first = seed({});
const firstOnboarding = first.tasks.filter((t) => t.itemKey.startsWith("tarea:"));
const firstCycleTasks = first.tasks.filter((t) => t.itemKey.startsWith("ciclo:"));
eq("primera siembra: todas las de inicio", firstOnboarding.length, crec.length);
ok(
  "primera siembra: inicio con fecha desde el inicio",
  firstOnboarding.filter((t) => t.dueDate).every((t) => t.dueDate >= TODAY),
);
eq(
  "primera siembra: brief el día de inicio",
  firstOnboarding.find((t) => t.key === "brief").dueDate,
  TODAY,
);
ok(
  "primera siembra: ciclo de octubre sin lo ya vencido",
  firstCycleTasks.length > 0 && firstCycleTasks.every((t) => t.dueDate >= TODAY),
);
eq("primera siembra: objetivos", first.objectives.length, s.PLAN_OBJECTIVES.crecimiento.length);
const ledger = new Set(first.ledgerAdd);
const again = seed({
  tasks: asTasks(first.tasks),
  objectives: asObjectives(first.objectives),
  ledger,
});
eq(
  "segunda siembra: nada",
  [again.tasks.length, again.objectives.length, again.ledgerAdd.length],
  [0, 0, 0],
);
eq(
  "día 25: agrega solo el mes siguiente",
  seed({
    tasks: asTasks(first.tasks),
    objectives: asObjectives(first.objectives),
    ledger,
    today: "2026-10-25",
  }).tasks.every((t) => t.itemKey.endsWith(":2026-11")),
  true,
);
eq("cliente no activo: sin ciclo", seed({ cycleActive: false }).tasks.length, crec.length);

const withoutLogo = asTasks(first.tasks.filter((t) => t.key !== "logo"));
eq(
  "borrada con registro: no vuelve",
  seed({ tasks: withoutLogo, objectives: asObjectives(first.objectives), ledger }).tasks.length,
  0,
);
eq(
  "borrada sin registro (etapa ya sembrada): no vuelve",
  seed({
    tasks: withoutLogo.filter((t) => !t.description.match(/:\d{4}-\d{2}\]/)),
    objectives: asObjectives(first.objectives),
    ledger: new Set(),
    cycleActive: false,
  }).tasks.length,
  0,
);
eq(
  "objetivos por título (sin migración): sin duplicar",
  seed({
    tasks: asTasks(first.tasks),
    objectives: asObjectives(first.objectives, false),
    ledger: new Set(),
    cycleActive: false,
  }).objectives.length,
  0,
);

// Cliente antiguo con tareas de plantilla: no recibe tareas de inicio nuevas.
const legacy = seed({
  tasks: [{ description: "[plantilla:estrategia:brief]" }],
  ledger: new Set(["tarea:estrategia:brief"]),
  clientStart: "2026-03-01",
  cycleActive: false,
});
eq("cliente antiguo: sin tareas de inicio nuevas", legacy.tasks.length, 0);
ok("cliente antiguo: igual recibe objetivos nuevos", legacy.objectives.length > 0);
const oldNoTemplates = seed({ clientStart: "2026-03-01", cycleActive: false });
eq(
  "cliente antiguo sin plantillas: inicio desde hoy",
  oldNoTemplates.tasks.find((t) => t.key === "brief").dueDate,
  TODAY,
);

// Clave de objetivo cambiada (entrega-72h → entrega-kit-landing): no duplica ni revive.
const mwCtx = ctx("marca-web");
const oldMw = [
  { title: "Título editado por el equipo", template_key: "objetivo:marca-web:entrega-72h" },
];
ok(
  "clave anterior presente: no duplica",
  !seed({ ctx: mwCtx, objectives: oldMw, cycleActive: false }).objectives.some(
    (o) => o.key === "entrega-kit-landing",
  ),
);
ok(
  "clave anterior borrada (en registro): no revive",
  !seed({
    ctx: mwCtx,
    ledger: new Set(["objetivo:marca-web:entrega-72h", "tarea:branding:brief"]),
    cycleActive: false,
  }).objectives.some((o) => o.key === "entrega-kit-landing"),
);
ok(
  "marca-web: sin ciclo aunque esté activo",
  seed({ ctx: mwCtx }).tasks.every((t) => t.itemKey.startsWith("tarea:")),
);

const chat = ctx("crecimiento", ["chatbot"]);
eq(
  "adicional nuevo: solo las tareas del chatbot",
  seed({
    ctx: chat,
    tasks: asTasks(first.tasks),
    objectives: asObjectives(first.objectives),
    ledger,
  }).tasks.map((t) => t.stage),
  s.STAGE_CHECKLISTS.chatbot.map(() => "chatbot"),
);

const userTask = [{ description: "Tarea creada a mano" }];
eq(
  "tareas a mano no cuentan como plantilla",
  seed({ tasks: userTask, cycleActive: false }).tasks.length,
  crec.length,
);
ok("isTemplateTask", s.isTemplateTask({ description: "x [plantilla:reporte:generado]" }));
ok("isTemplateTask (ciclo)", s.isTemplateTask({ description: "[plantilla:ads:anuncios:2026-10]" }));
ok(
  "isTemplateObjective por título",
  s.isTemplateObjective({ title: "publicar 12 piezas al MES" }, s.objectivesForPlan("contenido")),
);
ok(
  "registro antiguo",
  s.isLegacyLedgerKey("tarea:ads:pago") && !s.isLegacyLedgerKey("ciclo:x:2026-10"),
);

// ─── Plantilla anterior reemplazada por el ciclo ────────────────────────────
const oldTasks = [
  {
    id: "a",
    status: "pending",
    description: "Tarea estándar del plan.\n\n[plantilla:diseno:piezas]",
  },
  { id: "b", status: "done", description: "[plantilla:planificacion:calendario]" },
  { id: "c", status: "in_progress", description: "[plantilla:reporte:generado]" },
  { id: "d", status: "pending", description: "[plantilla:estrategia:brief]" },
  { id: "e", status: "pending", description: "[plantilla:optimizacion:revision-semanal]" },
  { id: "f", status: "pending", description: "[plantilla:reporte:enviado]" },
];
const retired = s.legacyToRetire(oldTasks, [
  "ciclo:piezas:2026-10",
  "ciclo:calendario:2026-10",
  "ciclo:reporte:2026-10",
  "ciclo:revision-campanas-2:2026-10",
]);
eq(
  "reemplaza solo abiertas con equivalente en el ciclo",
  retired.map((r) => r.id),
  ["a", "c", "e"],
);
eq(
  "marcador antiguo",
  retired[0].description,
  "Tarea estándar del plan.\n\n[plantilla-antigua:diseno:piezas]",
);
ok("reemplazada ya no es plantilla", !s.isTemplateTask({ description: retired[0].description }));
ok("reemplazada se oculta", s.isRetiredTask({ description: retired[0].description }));
eq("sin ciclo no reemplaza", s.legacyToRetire(oldTasks, []).length, 0);
eq(
  "siembra con ciclo reemplaza la vieja",
  seed({ ctx: ctx("contenido"), tasks: [oldTasks[0]], cycleActive: true }).retire.map((r) => r.id),
  ["a"],
);
eq(
  "cliente no activo: no reemplaza",
  seed({ ctx: ctx("contenido"), tasks: [oldTasks[0]], cycleActive: false }).retire.length,
  0,
);

// ─── Plan del mes (ficha) vs. ciclo ─────────────────────────────────────────
const monthItems = s.buildMonthPlan({ planKey: "contenido", month: "2026-11" });
const cycleRow = [
  {
    title: "x",
    due_date: "2026-11-03",
    description: "[plantilla:planificacion:calendario:2026-11]",
  },
];
eq("ciclo del mes detectado", s.cycleTasksOfMonth("2026-11", cycleRow).length, 1);
eq("ciclo de otro mes no cuenta", s.cycleTasksOfMonth("2026-12", cycleRow).length, 0);
eq(
  "sin ciclo: plan del mes completo",
  s.withoutCycleOverlap(monthItems, "2026-11", []).length,
  monthItems.length,
);
eq(
  "con ciclo: sin calendario, piezas ni reporte",
  [...new Set(s.withoutCycleOverlap(monthItems, "2026-11", cycleRow).map((i) => i.kind))].sort(),
  ["google", "reunion"],
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
eq("señales detectadas", [...sig].filter((x) => !x.includes("@")).sort(), [
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
eq("señales por mes", [...sig].filter((x) => x.includes("@")).sort(), [
  "report_generated@2026-08",
  "report_generated@2026-09",
  "report_sent@2026-08",
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
  s.detectedSignal({ status: "pending", description: "[plantilla:ads:pixel]" }, sig),
  null,
);
eq("tarea sin plantilla", s.detectedSignal({ status: "pending", description: null }, sig), null);
eq(
  "ciclo: reporte de septiembre generado",
  s.detectedSignal({ status: "pending", description: "[plantilla:reporte:reporte:2026-09]" }, sig),
  "report_generated",
);
eq(
  "ciclo: reporte de octubre aún no (no vale el de septiembre)",
  s.detectedSignal({ status: "pending", description: "[plantilla:reporte:reporte:2026-10]" }, sig),
  null,
);
eq(
  "ciclo: reporte de septiembre no enviado",
  s.detectedSignal(
    { status: "pending", description: "[plantilla:reporte:reporte-enviado:2026-09]" },
    sig,
  ),
  null,
);
eq(
  "ciclo: pago de pauta (estado actual)",
  s.detectedSignal({ status: "pending", description: "[plantilla:ads:pago-pauta:2026-10]" }, sig),
  "ads_billing_verified",
);
eq(
  "ciclo: tarea sin señal",
  s.detectedSignal(
    { status: "pending", description: "[plantilla:ads:revision-campanas-2:2026-10]" },
    sig,
  ),
  null,
);

if (failures.length > 0) {
  console.error(`check-plan-checklists: ${failures.length} fallo(s)`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("check-plan-checklists: OK");
