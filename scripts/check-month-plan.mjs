#!/usr/bin/env node
/**
 * Revisa el "Plan del mes" (src/lib/delivery/monthPlan.ts).
 * Uso: node scripts/check-month-plan.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "month-plan-check-"));
const outFile = join(outDir, "monthPlan.mjs");

await build({
  entryPoints: [join(root, "src/lib/delivery/monthPlan.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  alias: { "@": join(root, "src") },
  logLevel: "error",
});

const m = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

const MONTH = "2026-11";
const isWeekend = (d) => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay());
const count = (items, kind) => items.filter((i) => i.kind === kind).length;
const contenido = m.buildMonthPlan({ planKey: "contenido", month: MONTH });
const crecimiento = m.buildMonthPlan({ planKey: "crecimiento", month: MONTH });
const mantencion = m.buildMonthPlan({ planKey: "mantencion", month: MONTH });
const marcaWeb = m.buildMonthPlan({ planKey: "marca-web", month: MONTH });

// Fechas
check("valida mes", () => {
  assert.equal(m.isMonthKey("2026-11"), true);
  assert.equal(m.isMonthKey("2026-13"), false);
  assert.equal(m.isMonthKey("2026-1"), false);
  assert.equal(m.isMonthKey(null), false);
});
check("días hábiles de nov 2026 = 21", () => assert.equal(m.businessDays(MONTH).length, 21));
check("febrero bisiesto termina el 29", () =>
  assert.equal(m.monthBounds("2028-02").last, "2028-02-29"),
);
check("mes siguiente cruza el año", () => assert.equal(m.nextMonth("2026-12"), "2027-01"));
check("reparte parejo y en orden", () => {
  const days = m.businessDays(MONTH);
  const picked = m.spreadEvenly(days, 4);
  assert.equal(picked.length, 4);
  assert.deepEqual([...picked].sort(), picked);
  assert.ok(picked[0] < "2026-11-08" && picked[3] > "2026-11-22");
});

// Contenido
check("contenido: 12 piezas (8 posts + 4 reels)", () => {
  assert.equal(count(contenido, "post"), m.CONTENIDO.postsPerWeek * m.WEEKS_PER_MONTH);
  assert.equal(count(contenido, "reel"), m.CONTENIDO.reelsPerWeek * m.WEEKS_PER_MONTH);
  assert.equal(count(contenido, "post") + count(contenido, "reel"), 12);
});
check("contenido: 4 Google Business, calendario, reporte y reunión", () => {
  assert.equal(count(contenido, "google"), 4);
  assert.equal(count(contenido, "calendario"), 1);
  assert.equal(count(contenido, "reporte"), 1);
  assert.equal(count(contenido, "reunion"), 1);
  assert.equal(count(contenido, "campanas"), 0);
});
check("contenido: calendario el primer día hábil y reporte el último", () => {
  assert.equal(contenido.find((i) => i.kind === "calendario").dueDate, "2026-11-02");
  assert.equal(contenido.find((i) => i.kind === "reporte").dueDate, "2026-11-30");
});

// Crecimiento
check("crecimiento: contenido + revisión semanal de campañas", () => {
  assert.equal(count(crecimiento, "post") + count(crecimiento, "reel"), 12);
  assert.equal(count(crecimiento, "campanas"), 5); // nov 2026 tiene 5 semanas con días hábiles
  const weeks = crecimiento.filter((i) => i.kind === "campanas").map((i) => i.dueDate);
  assert.equal(new Set(weeks).size, weeks.length);
});
check("crecimiento: reporte de resultados", () =>
  assert.match(crecimiento.find((i) => i.kind === "reporte").title, /resultados/),
);

// Mantención (solo ex clientes)
check("mantención: 8 piezas al mes, calendario y reporte", () => {
  assert.equal(count(mantencion, "post"), 8);
  assert.equal(count(mantencion, "reel"), 0);
  assert.equal(count(mantencion, "calendario"), 1);
  assert.equal(count(mantencion, "reporte"), 1);
});
check("mantención: sin campañas, sin Google Business ni reunión", () => {
  assert.equal(count(mantencion, "campanas"), 0);
  assert.equal(count(mantencion, "google"), 0);
  assert.equal(count(mantencion, "reunion"), 0);
});
check("mantención: mes en curso prorratea las 8 piezas", () => {
  const items = m.buildMonthPlan({ planKey: "mantencion", month: MONTH, today: "2026-11-18" });
  assert.equal(count(items, "post"), 3); // 9 de 21 días hábiles
  assert.equal(count(items, "reporte"), 1);
});

// Marca + Web
check("marca-web: pasos del proyecto, del primer al último día hábil", () => {
  assert.equal(marcaWeb.length, m.MARCA_WEB_STEPS.length);
  assert.equal(marcaWeb[0].dueDate, "2026-11-02");
  assert.equal(marcaWeb.at(-1).dueDate, "2026-11-30");
});

// Reglas generales
const all = [...contenido, ...crecimiento, ...mantencion, ...marcaWeb];
check("nunca fines de semana y siempre dentro del mes", () => {
  for (const i of all) {
    assert.equal(isWeekend(i.dueDate), false, i.dueDate);
    assert.equal(i.dueDate.slice(0, 7), MONTH);
  }
});
check("ordenado por fecha", () => {
  for (const list of [contenido, crecimiento, mantencion, marcaWeb]) {
    const dates = list.map((i) => i.dueDate);
    assert.deepEqual([...dates].sort(), dates);
  }
});
check("claves únicas y marcador estable en la descripción", () => {
  for (const list of [contenido, crecimiento, mantencion, marcaWeb]) {
    assert.equal(new Set(list.map((i) => i.key)).size, list.length);
    for (const i of list)
      assert.deepEqual(m.readMarker(i.description), { month: MONTH, key: i.key });
  }
});
check("determinista", () =>
  assert.deepEqual(m.buildMonthPlan({ planKey: "crecimiento", month: MONTH }), crecimiento),
);
check("mes en curso: nada antes de hoy y cuotas prorrateadas", () => {
  const items = m.buildMonthPlan({ planKey: "contenido", month: MONTH, today: "2026-11-18" });
  assert.ok(items.length > 0);
  assert.ok(items.every((i) => i.dueDate >= "2026-11-18"));
  // Quedan 9 de 21 días hábiles: 8 posts → 3, 4 reels → 2, 4 Google → 2.
  assert.equal(count(items, "post"), 3);
  assert.equal(count(items, "reel"), 2);
  assert.equal(count(items, "google"), 2);
  assert.equal(count(items, "reporte"), 1);
});
check("prorrateo: mínimo 1 y nunca más que la cuota", () => {
  assert.equal(m.prorate(8, 0.01), 1);
  assert.equal(m.prorate(8, 1.5), 8);
  assert.equal(m.prorate(0, 0.5), 0);
});
check("mes siguiente va completo aunque hoy sea otro mes", () => {
  const items = m.buildMonthPlan({ planKey: "contenido", month: MONTH, today: "2026-10-28" });
  assert.equal(count(items, "post") + count(items, "reel"), 12);
});

// Feriados
check("excluye feriados nacionales (incluidos los movidos)", () => {
  assert.equal(m.businessDays("2026-12").includes("2026-12-08"), false);
  assert.equal(m.businessDays("2026-12").includes("2026-12-25"), false);
  assert.equal(m.businessDays("2027-10").includes("2027-10-11"), false);
  assert.equal(m.businessDays("2027-10").includes("2027-10-12"), true);
  assert.equal(m.businessDays("2027-06").includes("2027-06-28"), false);
  assert.equal(m.businessDays("2027-09").includes("2027-09-17"), false);
  assert.equal(m.businessDays("2026-10").includes("2026-10-12"), false);
});
check("ninguna tarea cae en feriado", () => {
  for (const month of ["2026-12", "2027-09", "2027-10"]) {
    for (const planKey of ["contenido", "crecimiento", "mantencion", "marca-web"]) {
      for (const i of m.buildMonthPlan({ planKey, month }))
        assert.equal(m.CL_HOLIDAYS.has(i.dueDate), false, i.dueDate);
    }
  }
});
check("la lista de feriados cubre el año actual (actualizar CL_HOLIDAYS)", () => {
  const year = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric" }).format(
      new Date(),
    ),
  );
  assert.ok(year <= m.CL_HOLIDAYS_LAST_YEAR, `año ${year} > ${m.CL_HOLIDAYS_LAST_YEAR}`);
});
check("mes pasado o inválido = vacío", () => {
  assert.deepEqual(
    m.buildMonthPlan({ planKey: "contenido", month: "2026-09", today: "2026-10-05" }),
    [],
  );
  assert.deepEqual(m.buildMonthPlan({ planKey: "contenido", month: "nov" }), []);
});
check("sin promesas de resultados", () => {
  for (const i of all)
    assert.doesNotMatch(`${i.title} ${i.description}`, /garant|asegur|seguidores|ventas/i);
});
check("nota interna: no se publica ni se envía", () => {
  for (const i of all) assert.match(i.description, /No se publica ni se envía al cliente/);
});

// Idempotencia
const post1 = contenido.find((i) => i.key === "post-1");
check("duplicado por marcador aunque cambie título o fecha", () => {
  const existing = [
    { title: "Otro título", due_date: "2026-11-27", description: post1.description },
  ];
  assert.equal(m.isDuplicate(post1, MONTH, existing), true);
});
check("duplicado por título + fecha (sin marcador)", () => {
  const existing = [
    { title: `  ${post1.title.toUpperCase()} `, due_date: post1.dueDate, description: null },
  ];
  assert.equal(m.isDuplicate(post1, MONTH, existing), true);
});
check("marcador de otro mes no cuenta", () => {
  const existing = [{ title: "x", due_date: null, description: m.planMarker("2026-10", "post-1") }];
  assert.equal(m.isDuplicate(post1, MONTH, existing), false);
});
check("mismo título otro día no es duplicado", () => {
  const existing = [{ title: post1.title, due_date: "2026-11-30", description: null }];
  assert.equal(m.isDuplicate({ ...post1, dueDate: "2026-11-03" }, MONTH, existing), false);
});
check("resumen del mes: total y generadas", () => {
  const existing = [
    { title: "a", due_date: "2026-11-05", description: null },
    { title: "b", due_date: "2026-11-06", description: m.planMarker(MONTH, "reel-1") },
    { title: "c", due_date: "2026-12-01", description: m.planMarker(MONTH, "reporte") },
    { title: "d", due_date: "2026-10-31", description: null },
  ];
  assert.deepEqual(m.summarizeExisting(MONTH, existing), { total: 3, fromPlan: 2 });
});

if (failures.length > 0) {
  console.error(`check-month-plan: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-month-plan: OK");
