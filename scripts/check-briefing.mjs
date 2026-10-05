#!/usr/bin/env node
/**
 * Revisa el "Resumen para reunión" (src/lib/briefing/meetingBrief.ts) y la
 * agregación de métricas de Meta por campaña (src/lib/meta-ads/campaignInsights.ts).
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

await build({
  entryPoints: {
    meetingBrief: join(root, "src/lib/briefing/meetingBrief.ts"),
    campaignInsights: join(root, "src/lib/meta-ads/campaignInsights.ts"),
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outdir: outDir,
  outExtension: { ".js": ".mjs" },
  alias: { "@": join(root, "src") },
  logLevel: "error",
});

const m = await import(pathToFileURL(join(outDir, "meetingBrief.mjs")).href);
const ci = await import(pathToFileURL(join(outDir, "campaignInsights.mjs")).href);
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
const W = m.briefWindows(TODAY);
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
  campaignsPartial: { meta: false, google: false },
  partialLists: [],
};
const section = (brief, key) => brief.sections.find((s) => s.key === key).lines.join("\n");

/** `n` días seguidos desde `from`, con dos anuncios por día (nivel 'ad'). */
function adRows(from, n, [spendA, spendB], [convA, convB], currency = "CLP") {
  return Array.from({ length: n }, (_, i) => {
    const [y, mo, d] = from.split("-").map(Number);
    const date = new Date(Date.UTC(y, mo - 1, d + i)).toISOString().slice(0, 10);
    return [
      { date, spend: spendA, currency, messaging_conversations_started: convA },
      { date, spend: spendB, currency, messaging_conversations_started: convB },
    ];
  }).flat();
}

const fullMeta = [
  // Período actual completo (30 días): 5.000/día y 1 conversación/día.
  ...adRows(W.from, 30, [3000, 2000], [1, 0]),
  // Período anterior con 24 de 30 días (80 %): 5.000/día y 1 conversación/día.
  ...adRows(W.prevFrom, 24, [2500, 2500], [1, 0]),
  // Fuera de ambas ventanas: se ignora.
  { date: "2026-07-01", spend: 999999, currency: "CLP", messaging_conversations_started: 999 },
];

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
    // 22:30 del 19 oct en Chile (01:30Z del 20): sigue dentro de las 2 semanas.
    { approved_at: null, published_at: null, scheduled_at: "2026-10-20T01:30:00Z" },
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
  reports: [{ sent_at: "2026-10-03T12:00:00Z" }],
  approvals: [
    { kind: "post_instagram", title: "Post <b>octubre</b>", created_at: "2026-09-28T12:00:00Z" },
    { kind: "entregable", title: null, created_at: "2026-10-01T12:00:00Z" },
    { kind: "propuesta", title: "Propuesta 2027", created_at: "2026-09-01T12:00:00Z" },
  ],
  payments: [
    { amount: 450000, currency: "CLP", status: "overdue", due_date: "2026-09-25" },
    { amount: 450000, currency: "CLP", status: "pending", due_date: "2026-10-25" },
  ],
  intakeSubmitted: false,
  meta: fullMeta,
};

check("ventanas de 30 días y comparación", () => {
  assert.equal(W.from, "2026-09-06");
  assert.equal(W.prevTo, "2026-09-05");
  assert.equal(W.prevFrom, "2026-08-07");
  assert.equal(W.nextTo, "2026-10-19");
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

check("preguntas priorizan aprobaciones (sin propuestas) y onboarding", () => {
  const q = m.suggestedQuestions(full);
  assert.match(q[0], /2 piezas pendientes/);
  assert.match(q[1], /onboarding/);
  assert.match(q[2], /Meta Ads.*cotización o venta/);
});

check("preguntas por plataforma, sin sumar Meta y Google", () => {
  const q = m.suggestedQuestions({
    ...empty,
    meta: adRows(W.from, 30, [1000, 0], [0, 0]),
    google: [{ date: "2026-10-02", cost_clp: 30000, conversions: 3 }],
  });
  assert.match(q[0], /Google Ads.*clientes reales/);
  assert.match(q[1], /atraer con Meta Ads/);
});

check("Meta nivel anuncio: suma filas del mismo día, compara y calcula costo", () => {
  const r = section(m.buildMeetingBrief(full), "resultados");
  assert.match(r, /^Meta Ads: inversión \$150\.000 \(\+25% vs\. período anterior\)/);
  assert.match(r, /30 conversaciones iniciadas \(\+25% vs\. período anterior\)/);
  assert.match(r, /Costo por conversación: \$5\.000/);
  assert.doesNotMatch(r, /999/);
  assert.doesNotMatch(r, /datos de \d+ de 30/);
  assert.doesNotMatch(r, /Google/);
});

check("cobertura: período anterior incompleto no se compara; actual incompleto se avisa", () => {
  const r = section(
    m.buildMeetingBrief({
      ...empty,
      meta: [
        ...adRows(W.from, 10, [1000, 1000], [1, 1]),
        ...adRows(W.prevFrom, 23, [500, 500], [1, 0]),
      ],
    }),
    "resultados",
  );
  assert.match(
    r,
    /Meta Ads \(datos de 10 de 30 días\): inversión \$20\.000 \(sin datos completos del período anterior\)/,
  );
  assert.match(r, /20 conversaciones iniciadas \(sin datos completos del período anterior\)/);
  assert.doesNotMatch(r, /%/);
});

check("sin período anterior no inventa variación", () => {
  const r = section(
    m.buildMeetingBrief({
      ...empty,
      google: [{ date: "2026-10-02", cost_clp: 30000, conversions: 0 }],
    }),
    "resultados",
  );
  assert.match(
    r,
    /Google Ads \(datos de 1 de 30 días\): inversión \$30\.000 \(sin datos completos del período anterior\)/,
  );
  assert.doesNotMatch(r, /Costo por conversión/);
});

check("moneda distinta de CLP: no se suma ni se calcula costo ni % de inversión", () => {
  const r = section(
    m.buildMeetingBrief({
      ...empty,
      meta: [
        ...adRows(W.from, 30, [10000, 0], [1, 0]),
        ...adRows(W.prevFrom, 30, [10000, 0], [1, 0]),
        { date: "2026-10-02", spend: 50, currency: "USD", messaging_conversations_started: 0 },
      ],
    }),
    "resultados",
  );
  assert.match(r, /inversión \$300\.000 \(sin incluir montos en USD\)\./);
  assert.doesNotMatch(r, /Costo por conversación/);
  assert.match(r, /30 conversaciones iniciadas \(igual que el período anterior\)/);
});

check("datos truncados → sin totales de esa plataforma", () => {
  const r = section(
    m.buildMeetingBrief({
      ...full,
      google: [{ date: "2026-10-02", cost_clp: 30000, conversions: 2 }],
      campaignsPartial: { meta: true, google: false },
    }),
    "resultados",
  );
  assert.match(r, /Meta Ads: hay demasiados registros/);
  assert.doesNotMatch(r, /\$150/);
  assert.match(r, /Google Ads/);
});

check("qué hicimos: solo últimos 30 días y rotulado como 'marcadas como terminadas'", () => {
  const h = section(m.buildMeetingBrief(full), "hicimos");
  assert.match(h, /1 entrega marcada como terminada en el período/);
  assert.match(h, /Reel lanzamiento \(reel\)/);
  assert.doesNotMatch(h, /Viejo/);
  assert.match(h, /1 publicación en Instagram/);
  assert.match(h, /1 post aprobado/);
  assert.match(h, /1 tarea marcada como terminada/);
  assert.match(h, /Grabar testimonios/);
  assert.match(h, /1 reporte mensual enviado/);
});

check("pendientes: aprobaciones del cliente, onboarding y cobros en CLP", () => {
  const p = section(m.buildMeetingBrief(full), "pendientes");
  assert.match(p, /2 piezas esperan su aprobación, la más antigua hace 7 días/);
  assert.match(p, /Entrega: sin título/);
  assert.doesNotMatch(p, /Propuesta/);
  assert.match(p, /formulario de onboarding/);
  assert.match(p, /1 cobro vencido por \$450\.000/);
  assert.match(p, /1 cobro pendiente por \$450\.000, el próximo vence el 25 oct/);
});

check("antigüedad: hoy / ayer / hace N días", () => {
  assert.equal(m.agoLabel(0), "de hoy");
  assert.equal(m.agoLabel(1), "de ayer");
  assert.equal(m.agoLabel(9), "hace 9 días");
  const p = section(
    m.buildMeetingBrief({
      ...empty,
      approvals: [{ kind: "entregable", title: "X", created_at: "2026-10-05T15:00:00Z" }],
    }),
    "pendientes",
  );
  assert.match(p, /1 pieza espera su aprobación, la más antigua de hoy/);
});

check("próximos pasos: 2 semanas (fin de día en Chile), atrasadas primero", () => {
  const n = section(m.buildMeetingBrief(full), "proximos").split("\n");
  assert.equal(n[0], "Atrasada (1 oct): Pedir fotos");
  assert.equal(n[1], "10 oct: Carrusel promo (post)");
  assert.match(n.join("\n"), /2 publicaciones programadas/);
  assert.doesNotMatch(n.join("\n"), /Lejana/);
});

check("listas parciales se marcan", () => {
  const b = m.buildMeetingBrief({ ...full, partialLists: ["approvals", "tasks"] });
  assert.match(section(b, "pendientes"), /lista parcial/);
  assert.match(section(b, "hicimos"), /lista parcial/);
  assert.match(section(b, "proximos"), /lista parcial/);
  assert.doesNotMatch(section(m.buildMeetingBrief(full), "pendientes"), /lista parcial/);
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

check("HTML de impresión escapa el contenido e imprime al cargar solo si se pide", () => {
  const brief = m.buildMeetingBrief(full);
  const html = m.briefToPrintHtml(brief);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /Post &lt;b&gt;octubre&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>octubre/);
  assert.doesNotMatch(html, /<script/);
  assert.match(m.briefToPrintHtml(brief, { autoPrint: true }), /window\.print\(\)/);
  assert.equal(m.escapeHtml(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
});

check("sin promesas de resultados", () => {
  const t = m.briefToText(m.buildMeetingBrief(full)).toLowerCase();
  for (const word of ["garantiz", "aseguramos", "vamos a duplicar", "prometemos"]) {
    assert.ok(!t.includes(word), `contiene "${word}"`);
  }
});

check("MetaAdsPanel: agrega filas por anuncio en campaña y día", () => {
  const rows = [
    {
      campaign_id: "c1",
      date: "2026-10-01",
      impressions: 1000,
      reach: 800,
      clicks: 10,
      spend: 3000,
      messaging_conversations_started: 2,
    },
    {
      campaign_id: "c1",
      date: "2026-10-01",
      impressions: 1000,
      reach: 700,
      clicks: 30,
      spend: 1000,
      messaging_conversations_started: 1,
    },
    {
      campaign_id: "c1",
      date: "2026-10-02",
      impressions: 0,
      reach: 0,
      clicks: 0,
      spend: 0,
      messaging_conversations_started: 0,
    },
    {
      campaign_id: "c2",
      date: "2026-10-01",
      impressions: 500,
      reach: 400,
      clicks: 5,
      spend: 500,
      messaging_conversations_started: 0,
    },
    {
      campaign_id: null,
      date: "2026-10-01",
      impressions: 9,
      reach: 9,
      clicks: 9,
      spend: 9,
      messaging_conversations_started: 9,
    },
  ];
  const out = ci.aggregateByCampaignDay(rows);
  assert.deepEqual(
    out.map((r) => r.id),
    ["c1:2026-10-02", "c1:2026-10-01", "c2:2026-10-01"],
  );
  const c1 = out[1];
  assert.equal(c1.impressions, 2000);
  assert.equal(c1.reach, 1500);
  assert.equal(c1.clicks, 40);
  assert.equal(c1.spend, 4000);
  assert.equal(c1.messaging_conversations_started, 3);
  assert.equal(c1.ctr, 2);
  assert.equal(c1.cpm, 2000);
  assert.equal(out[0].ctr, null);
  assert.equal(out[0].cpm, null);
});

if (failures.length) {
  console.error(`check-briefing: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-briefing: OK");
