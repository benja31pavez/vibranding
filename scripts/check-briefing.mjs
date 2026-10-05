#!/usr/bin/env node
/**
 * Revisa el "Resumen para reunión" (src/lib/briefing/meetingBrief.ts).
 * Uso: node scripts/check-briefing.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "briefing-check-"));
const outFile = join(outDir, "meetingBrief.mjs");

await build({
  entryPoints: [join(root, "src/lib/briefing/meetingBrief.ts")],
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

const TODAY = "2026-10-05";
const empty = {
  clientName: "Proyecta Exteriores",
  today: TODAY,
  health: null,
  deliverables: [],
  posts: [],
  tasks: [],
  reports: [],
  approvals: [],
  payments: [],
  intakeSubmitted: null,
  meta: [],
  google: [],
  campaignsTruncated: false,
};
const section = (brief, key) => brief.sections.find((s) => s.key === key).lines.join("\n");

const full = {
  ...empty,
  health: {
    level: "atencion",
    reasons: [
      { code: "aprobacion_estancada", severity: "warning", label: "2 piezas esperan aprobación" },
    ],
  },
  deliverables: [
    {
      title: "Reel lanzamiento",
      type: "reel",
      status: "done",
      updated_at: "2026-09-20T15:00:00Z",
      due_date: null,
    },
    {
      title: "Viejo",
      type: "post",
      status: "done",
      updated_at: "2026-08-01T15:00:00Z",
      due_date: null,
    },
    {
      title: "Carrusel promo",
      type: "post",
      status: "pending",
      updated_at: "2026-10-01T15:00:00Z",
      due_date: "2026-10-10",
    },
  ],
  posts: [
    {
      approved_at: "2026-09-25T12:00:00Z",
      published_at: "2026-09-26T12:00:00Z",
      scheduled_at: null,
    },
    { approved_at: null, published_at: null, scheduled_at: "2026-10-12T12:00:00Z" },
  ],
  tasks: [
    {
      title: "Grabar testimonios",
      status: "done",
      due_date: "2026-09-15",
      updated_at: "2026-09-15T20:00:00Z",
    },
    {
      title: "Pedir fotos",
      status: "pending",
      due_date: "2026-10-01",
      updated_at: "2026-09-01T00:00:00Z",
    },
    {
      title: "Lejana",
      status: "pending",
      due_date: "2026-11-30",
      updated_at: "2026-09-01T00:00:00Z",
    },
  ],
  reports: [{ period: "2026-09-01", sent_at: "2026-10-03T12:00:00Z" }],
  approvals: [
    { kind: "post_instagram", title: "Post <b>octubre</b>", created_at: "2026-09-28T12:00:00Z" },
    { kind: "entregable", title: null, created_at: "2026-10-01T12:00:00Z" },
  ],
  payments: [
    {
      amount: 450000,
      currency: "CLP",
      status: "overdue",
      due_date: "2026-09-25",
      description: null,
    },
    {
      amount: 450000,
      currency: "CLP",
      status: "pending",
      due_date: "2026-10-25",
      description: null,
    },
  ],
  intakeSubmitted: false,
  meta: [
    { date: "2026-10-01", spend: 100000, currency: "CLP", messaging_conversations_started: 20 },
    { date: "2026-09-10", spend: 50000, currency: "CLP", messaging_conversations_started: 5 },
    { date: "2026-08-20", spend: 100000, currency: "CLP", messaging_conversations_started: 10 },
    { date: "2026-07-01", spend: 999999, currency: "CLP", messaging_conversations_started: 999 },
  ],
};

check("ventanas de 30 días y comparación", () => {
  const w = m.briefWindows(TODAY);
  assert.equal(w.from, "2026-09-06");
  assert.equal(w.prevTo, "2026-09-05");
  assert.equal(w.prevFrom, "2026-08-07");
  assert.equal(w.nextTo, "2026-10-19");
});

check("seis secciones en orden", () => {
  const b = m.buildMeetingBrief(empty);
  assert.deepEqual(
    b.sections.map((s) => s.key),
    ["estado", "hicimos", "resultados", "pendientes", "proximos", "preguntas"],
  );
  assert.match(b.title, /Proyecta Exteriores/);
});

check("sin campañas → 'Sin datos de campañas' y sin cifras", () => {
  const r = section(m.buildMeetingBrief(empty), "resultados");
  assert.equal(r, "Sin datos de campañas.");
  assert.doesNotMatch(r, /\$/);
});

check("estados vacíos legibles", () => {
  const b = m.buildMeetingBrief(empty);
  assert.match(section(b, "estado"), /Sin evaluación/);
  assert.match(section(b, "hicimos"), /Sin entregas/);
  assert.match(section(b, "pendientes"), /Nada pendiente/);
  assert.match(section(b, "proximos"), /Sin tareas/);
});

check("siempre 3 preguntas, sin repetir", () => {
  for (const input of [empty, full]) {
    const q = m.suggestedQuestions(input);
    assert.equal(q.length, 3);
    assert.equal(new Set(q).size, 3);
  }
});

check("preguntas priorizan aprobaciones y onboarding", () => {
  const q = m.suggestedQuestions(full);
  assert.match(q[0], /2 piezas pendientes/);
  assert.match(q[1], /onboarding/);
  assert.match(q[2], /cotización o venta/);
});

check("Meta: suma solo la ventana, compara y calcula costo por conversación", () => {
  const r = section(m.buildMeetingBrief(full), "resultados");
  assert.match(r, /Meta Ads: inversión \$150\.000/);
  assert.match(r, /\+50% vs\. período anterior/);
  assert.match(r, /25 conversaciones iniciadas \(\+150%/);
  assert.match(r, /Costo por conversación: \$6\.000/);
  assert.doesNotMatch(r, /999/);
  assert.doesNotMatch(r, /Google/);
});

check("sin período anterior no inventa variación", () => {
  const r = section(
    m.buildMeetingBrief({
      ...empty,
      google: [{ date: "2026-10-02", cost_clp: 30000, conversions: 0 }],
    }),
    "resultados",
  );
  assert.match(r, /Google Ads: inversión \$30\.000 \(sin datos del período anterior\)/);
  assert.doesNotMatch(r, /Costo por conversión/);
});

check("moneda distinta de CLP no se suma", () => {
  const r = section(
    m.buildMeetingBrief({
      ...empty,
      meta: [
        { date: "2026-10-01", spend: 10000, currency: "CLP", messaging_conversations_started: 0 },
        { date: "2026-10-02", spend: 50, currency: "USD", messaging_conversations_started: 0 },
      ],
    }),
    "resultados",
  );
  assert.match(r, /\$10\.000 \(sin incluir montos en USD\)/);
});

check("datos truncados → sin totales", () => {
  const r = section(m.buildMeetingBrief({ ...full, campaignsTruncated: true }), "resultados");
  assert.match(r, /demasiados registros/);
  assert.doesNotMatch(r, /\$/);
});

check("qué hicimos: solo últimos 30 días", () => {
  const h = section(m.buildMeetingBrief(full), "hicimos");
  assert.match(h, /1 entrega terminada/);
  assert.match(h, /Reel lanzamiento \(reel\)/);
  assert.doesNotMatch(h, /Viejo/);
  assert.match(h, /1 publicación en Instagram/);
  assert.match(h, /1 post aprobado/);
  assert.match(h, /Grabar testimonios/);
  assert.match(h, /1 reporte mensual enviado/);
});

check("pendientes: aprobaciones, onboarding y cobros en CLP", () => {
  const p = section(m.buildMeetingBrief(full), "pendientes");
  assert.match(p, /2 piezas esperan su aprobación, la más antigua hace 7 días/);
  assert.match(p, /Entrega: sin título/);
  assert.match(p, /formulario de onboarding/);
  assert.match(p, /1 cobro vencido por \$450\.000/);
  assert.match(p, /1 cobro pendiente por \$450\.000, el próximo vence el 25 oct/);
});

check("próximos pasos: 2 semanas, atrasadas primero y programados", () => {
  const n = section(m.buildMeetingBrief(full), "proximos").split("\n");
  assert.equal(n[0], "Atrasada (1 oct): Pedir fotos");
  assert.equal(n[1], "10 oct: Carrusel promo (post)");
  assert.match(n.join("\n"), /1 publicación programada/);
  assert.doesNotMatch(n.join("\n"), /Lejana/);
});

check("estado con nivel y motivos; error de salud explícito", () => {
  assert.match(
    section(m.buildMeetingBrief(full), "estado"),
    /Atención\.\n2 piezas esperan aprobación/,
  );
  assert.match(
    section(m.buildMeetingBrief({ ...full, healthError: true }), "estado"),
    /No se pudo calcular/,
  );
});

check("listas largas se acotan", () => {
  const many = Array.from({ length: 8 }, (_, i) => ({
    kind: "entregable",
    title: `P${i}`,
    created_at: "2026-10-01T00:00:00Z",
  }));
  const p = section(m.buildMeetingBrief({ ...empty, approvals: many }), "pendientes");
  assert.match(p, /y 3 más/);
  assert.doesNotMatch(p, /P7/);
});

check("texto plano con títulos y viñetas", () => {
  const t = m.briefToText(m.buildMeetingBrief(full));
  assert.match(t, /^Resumen para reunión: Proyecta Exteriores\n/);
  assert.match(t, /1\. ESTADO\n• Atención\./);
  assert.match(t, /6\. PREGUNTAS SUGERIDAS\n1\. /);
});

check("HTML de impresión escapa el contenido", () => {
  const html = m.briefToPrintHtml(m.buildMeetingBrief(full));
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /Post &lt;b&gt;octubre&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>octubre/);
  assert.equal(m.escapeHtml(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
});

check("sin promesas de resultados", () => {
  const t = m.briefToText(m.buildMeetingBrief(full)).toLowerCase();
  for (const word of ["garantiz", "aseguramos", "vamos a duplicar", "prometemos"]) {
    assert.ok(!t.includes(word), `contiene "${word}"`);
  }
});

if (failures.length) {
  console.error(`check-briefing: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-briefing: OK");
