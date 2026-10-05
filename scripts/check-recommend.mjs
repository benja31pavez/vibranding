#!/usr/bin/env node
/**
 * Revisa las reglas de "propuesta rápida" (src/lib/proposals/recommend.ts).
 * Uso: node scripts/check-recommend.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "recommend-check-"));
const outFile = join(outDir, "recommend.mjs");

await build({
  entryPoints: [join(root, "src/lib/proposals/recommend.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  alias: { "@": join(root, "src") },
  logLevel: "error",
});

const r = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

const NOTE =
  "Diagnóstico web 05-10-2026 · quiere: Más consultas por WhatsApp o formulario · " +
  "presupuesto: Menos de $150.000 al mes · plan de interés: crecimiento · aceptó ser contactado";
const none = { objetivo: null, presupuesto: null, planInteres: null };

check("lee la nota del diagnóstico", () => {
  assert.deepEqual(r.readDiagnosticoSignals(NOTE), {
    objetivo: "consultas",
    presupuesto: "menos-150",
    planInteres: "crecimiento",
  });
});
check("sin notas → señales vacías", () => assert.deepEqual(r.readDiagnosticoSignals(null), none));
check("nota sin diagnóstico → señales vacías", () => assert.deepEqual(r.readDiagnosticoSignals("llamar el lunes"), none));
check("toma la última nota si hay varias", () => {
  const s = r.readDiagnosticoSignals(`${NOTE}\nDiagnóstico web · quiere: Una marca más profesional · plan de interés: marca-web`);
  assert.equal(s.objetivo, "marca");
  assert.equal(s.planInteres, "marca-web");
});
check("plan de interés desconocido se ignora", () =>
  assert.equal(r.readDiagnosticoSignals("plan de interés: premium").planInteres, null));

const rec = (productoSugerido, signals) => r.recommendPlan({ productoSugerido, signals: { ...none, ...signals } });

check("ficha manda sobre todo (sin tope)", () => {
  const out = rec("crecimiento", { planInteres: "contenido", presupuesto: "menos-150" });
  assert.equal(out.planKey, "crecimiento");
  assert.equal(out.source, "ficha");
});
check("plan de interés sin presupuesto", () => assert.equal(rec(null, { planInteres: "crecimiento" }).planKey, "crecimiento"));
check("plan de interés ajustado a menos de 150 mil", () => {
  const out = rec(null, { planInteres: "crecimiento", presupuesto: "menos-150" });
  assert.equal(out.planKey, "contenido");
  assert.equal(out.adjustedForBudget, true);
});
check("150-300 alcanza para Crecimiento", () =>
  assert.equal(rec(null, { planInteres: "crecimiento", presupuesto: "150-300" }).planKey, "crecimiento"));
check("pago único no se ajusta por presupuesto mensual", () =>
  assert.equal(rec(null, { planInteres: "marca-web", presupuesto: "menos-150" }).planKey, "marca-web"));
check("objetivo consultas → Crecimiento", () => {
  const out = rec(null, { objetivo: "consultas" });
  assert.equal(out.planKey, "crecimiento");
  assert.equal(out.source, "objetivo");
});
check("objetivo web → Marca + Web", () => assert.equal(rec(null, { objetivo: "web" }).planKey, "marca-web"));
check("sin datos → sin plan", () => {
  const out = rec("", {});
  assert.equal(out.planKey, null);
  assert.equal(out.source, "sin_datos");
});
check("todos los objetivos tienen plan válido", () => {
  for (const goal of Object.keys(r.GOAL_TO_PLAN)) assert.ok(rec(null, { objetivo: goal }).planKey, goal);
});

const FORBIDDEN = /garant|reembols|devoluci|asegura|\d+\s?%|x\d|duplic|tripl/i;
const goals = [null, ...Object.keys(r.GOAL_PHRASE)];
const plans = [null, "marca-web", "contenido", "crecimiento"];
for (const objetivo of goals) {
  for (const planKey of plans) {
    const intro = r.buildProposalIntro({ nombre: "Café Luna", rubro: "Cafetería", comuna: "Ñuñoa", objetivo, planKey });
    check(`intro sin promesas [${objetivo}/${planKey}]`, () => assert.doesNotMatch(intro, FORBIDDEN));
    check(`intro corto [${objetivo}/${planKey}]`, () => assert.ok(intro.length <= r.INTRO_MAX_CHARS));
    check(`intro con nombre [${objetivo}/${planKey}]`, () => assert.match(intro, /Café Luna/));
    check(`chatbot solo como adicional [${objetivo}/${planKey}]`, () => {
      if (/chatbot/i.test(intro)) assert.match(intro, /adicional, con costo aparte/);
    });
    check(`intro sin otras monedas [${objetivo}/${planKey}]`, () => assert.doesNotMatch(intro, /USD|US\$|€/));
  }
}
check("intro usa rubro, comuna y precio del plan", () => {
  const intro = r.buildProposalIntro({ nombre: "Café Luna", rubro: "Cafetería", comuna: "Ñuñoa", objetivo: "ventas", planKey: "contenido" });
  assert.match(intro, /cafetería en Ñuñoa/);
  assert.match(intro, /vender más/);
  assert.match(intro, /\$129\.990\/mes/);
});
check("intro tolera datos vacíos", () => {
  const intro = r.buildProposalIntro({ nombre: "  ", rubro: null, comuna: undefined, objetivo: null, planKey: null });
  assert.match(intro, /su negocio/);
  assert.doesNotMatch(intro, /undefined|null/);
});

check("avanza solo desde estados previos", () => {
  for (const s of ["nuevo", "contactado", "respondio", "demo"]) assert.equal(r.shouldAdvanceToProposal(s), true, s);
  for (const s of ["propuesta", "ganado", "frio", "perdido", "baja", null, "otro"]) {
    assert.equal(r.shouldAdvanceToProposal(s), false, String(s));
  }
});
check("baja no puede recibir propuesta", () => {
  assert.equal(r.canCreateProposalFor("baja"), false);
  assert.equal(r.canCreateProposalFor("frio"), true);
});

if (failures.length > 0) {
  console.error(`check-recommend: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-recommend: OK");
