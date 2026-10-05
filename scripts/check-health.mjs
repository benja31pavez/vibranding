#!/usr/bin/env node
/**
 * Revisa las reglas puras de "Salud del cliente" (src/lib/health) con datos falsos.
 * Uso: node scripts/check-health.mjs  (o npm run check:health)
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "health-check-"));
const outFile = join(outDir, "health.mjs");

await build({
  entryPoints: [join(root, "src/lib/health/index.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  alias: { "@": join(root, "src") },
  logLevel: "error",
});

const h = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

// 15 oct 2026, 12:00 en Chile.
const NOW = new Date("2026-10-15T15:00:00Z");
const TODAY = "2026-10-15";
const T = h.HEALTH_THRESHOLDS;
const ago = (n) => addDays(TODAY, -n);
function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
}
const iso = (ymd) => `${ymd}T15:00:00Z`;

const client = (id, extra = {}) => ({
  id,
  name: id,
  status: "activo",
  created_at: iso(ago(200)),
  started_at: ago(200),
  ...extra,
});

const empty = {
  clients: [],
  payments: [],
  approvals: [],
  changeRequests: [],
  alerts: [],
  reports: [],
  activity: [],
  subscriptions: [],
  onboarding: { withToken: [], submitted: [] },
};

/** Cliente sano: actividad reciente y reporte del mes cerrado enviado. */
const healthy = (id) => ({
  activity: [{ client_id: id, at: iso(ago(2)) }],
  reports: [{ client_id: id, period: h.closedPeriod(TODAY), sent_at: iso(ago(5)) }],
});

function run(id, extra = {}, clientExtra = {}) {
  const base = healthy(id);
  const sources = {
    ...empty,
    ...extra,
    clients: [client(id, clientExtra)],
    activity: [...base.activity, ...(extra.activity ?? [])],
    reports: extra.reports ?? base.reports,
  };
  return h.computeClientHealth(sources, NOW).get(id);
}

const failures = [];
function expect(name, actual, expected) {
  if (actual !== expected)
    failures.push(
      `${name}: esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`,
    );
}
const codes = (r) => r?.reasons.map((x) => x.code).join(",") ?? "(sin puntaje)";

// --- base
expect("sano → bien", run("a")?.level, "bien");
expect("sano → score 100", run("a")?.score, h.HEALTH_MAX_SCORE);
expect("sano → sin acción", run("a")?.nextAction, null);

// --- cobros
const pay = (status, due, id = "p") => ({ payments: [{ client_id: id, status, due_date: due }] });
expect("cobro vencido reciente → atención", run("p", pay("overdue", ago(2)))?.level, "atencion");
expect(
  "cobro vencido viejo → riesgo",
  run("p", pay("overdue", ago(T.overdueRiskDays)))?.level,
  "en_riesgo",
);
expect(
  "pending con due pasado cuenta como vencido",
  codes(run("p", pay("pending", ago(1)))),
  "cobro_vencido",
);
expect("pending que vence hoy no está vencido", run("p", pay("pending", TODAY))?.level, "bien");

// --- aprobaciones
const appr = (n, id = "q") => ({ approvals: [{ client_id: id, created_at: iso(ago(n)) }] });
expect("aprobación corta → bien", run("q", appr(T.approvalWaitWarnDays - 1))?.level, "bien");
expect(
  "aprobación estancada → atención",
  run("q", appr(T.approvalWaitWarnDays))?.level,
  "atencion",
);
expect(
  "aprobación muy estancada → riesgo",
  run("q", appr(T.approvalWaitRiskDays))?.level,
  "en_riesgo",
);

// --- cambios pedidos
const chg = (n) => ({ changeRequests: [{ client_id: "c", created_at: iso(ago(n)) }] });
expect("cambios hoy → bien", run("c", chg(0))?.level, "bien");
expect(
  "cambios sin resolver → atención",
  run("c", chg(T.changeRequestWarnDays))?.level,
  "atencion",
);
expect("cambios viejos → riesgo", run("c", chg(T.changeRequestRiskDays))?.level, "en_riesgo");

// --- alertas
const alert = (severity, n, id = "x") => ({
  alerts: [{ client_id: id, severity, created_at: iso(ago(n)) }],
});
expect("alerta crítica → riesgo", run("x", alert("critical", 0))?.level, "en_riesgo");
expect("alerta warning nueva → bien", run("x", alert("warning", 0))?.level, "bien");
expect(
  "alerta warning vieja → atención",
  run("x", alert("warning", T.alertWarnDays))?.level,
  "atencion",
);
expect("alerta info → bien", run("x", alert("info", 30))?.level, "bien");

// --- reporte mensual
expect(
  "sin reporte del mes cerrado → atención",
  codes(run("r", { reports: [] })),
  "reporte_sin_enviar",
);
expect(
  "reporte creado pero no enviado → atención",
  codes(run("r", { reports: [{ client_id: "r", period: h.closedPeriod(TODAY), sent_at: null }] })),
  "reporte_sin_enviar",
);
expect(
  "cliente nuevo este mes no exige reporte",
  run("r", { reports: [] }, { started_at: "2026-10-02", created_at: iso("2026-10-02") })?.level,
  "bien",
);

// --- inactividad
const idle = (n) => {
  const sources = {
    ...empty,
    clients: [client("i")],
    reports: healthy("i").reports,
    activity: n === null ? [] : [{ client_id: "i", at: iso(ago(n)) }],
  };
  return h.computeClientHealth(sources, NOW).get("i");
};
expect("actividad hace 20 días → bien", idle(T.inactivityWarnDays - 1)?.level, "bien");
expect("sin actividad 21 días → atención", idle(T.inactivityWarnDays)?.level, "atencion");
expect("sin actividad 45 días → riesgo", idle(T.inactivityRiskDays)?.level, "en_riesgo");
expect("sin ninguna actividad → riesgo", idle(null)?.level, "en_riesgo");
expect("días desde actividad", idle(10)?.daysSinceActivity, 10);

// --- renovación
const sub = (startedAt, minMonths, status = "activa") => ({
  subscriptions: [{ client_id: "s", status, started_at: startedAt, min_months: minMonths }],
});
expect(
  "permanencia termina en 20 días → atención",
  run("s", sub(h.addMonthsYmd(addDays(TODAY, 20), -3), 3))?.level,
  "atencion",
);
expect(
  "permanencia termina en 5 días → riesgo",
  run("s", sub(h.addMonthsYmd(addDays(TODAY, 5), -6), 6))?.level,
  "en_riesgo",
);
expect("permanencia lejana → bien", run("s", sub("2026-09-01", 12))?.level, "bien");
expect("permanencia ya cumplida → bien", run("s", sub("2025-01-01", 6))?.level, "bien");
expect(
  "suscripción cancelada se ignora",
  run("s", sub(h.addMonthsYmd(addDays(TODAY, 5), -6), 6, "cancelada"))?.level,
  "bien",
);
expect("addMonths fin de mes", h.addMonthsYmd("2026-01-31", 1), "2026-02-28");

// --- onboarding
const onb = (n, status = "onboarding", ob = { withToken: ["o"], submitted: [] }) =>
  run("o", { onboarding: ob }, { status, started_at: ago(n), created_at: iso(ago(n)) });
expect("onboarding reciente → bien", onb(T.onboardingWarnDays - 1)?.level, "bien");
expect("onboarding incompleto → atención", onb(T.onboardingWarnDays)?.level, "atencion");
expect("onboarding muy atrasado → riesgo", onb(T.onboardingRiskDays)?.level, "en_riesgo");
expect(
  "onboarding enviado → sin motivo",
  onb(T.onboardingRiskDays, "onboarding", { withToken: ["o"], submitted: ["o"] })?.level,
  "bien",
);
expect(
  "activo sin token ni intake → no exige onboarding",
  codes(onb(T.onboardingRiskDays, "activo", { withToken: [], submitted: [] })),
  "",
);

// --- estados
expect("pausado → atención", codes(run("z", {}, { status: "pausado" })), "servicio_pausado");
expect("prospecto → sin puntaje", run("z", {}, { status: "prospecto" }), undefined);
expect("terminado → sin puntaje", run("z", {}, { status: "terminado" }), undefined);

// --- acumulación y orden
const many = run("m", {
  ...pay("overdue", ago(1), "m"),
  ...appr(T.approvalWaitWarnDays, "m"),
  reports: [],
});
expect(`${T.warningsForRisk} motivos de atención → riesgo`, many?.level, "en_riesgo");
expect(
  "score baja con cada motivo",
  many?.score,
  h.HEALTH_MAX_SCORE - 3 * h.HEALTH_WEIGHTS.warning,
);
const mixed = run("m", { ...pay("overdue", ago(1), "m"), ...alert("critical", 0, "m") });
expect("riesgo va primero en motivos", mixed?.reasons[0].code, "alerta_campana");
expect("acción sugerida = motivo más grave", mixed?.nextAction, mixed?.reasons[0].action);

const list = [run("a"), many, run("p", pay("overdue", ago(2))), undefined];
const sorted = [...list].sort(h.compareByRisk).map((x) => x?.level ?? "none");
expect("orden En riesgo primero", sorted.join(","), "en_riesgo,atencion,bien,none");
expect(
  "conteo por nivel",
  JSON.stringify(h.countByLevel([run("a"), many])),
  JSON.stringify({ bien: 1, atencion: 0, en_riesgo: 1 }),
);

// --- textos en español, sin moneda extranjera
for (const r of [many, mixed, idle(null), onb(30)]) {
  for (const reason of r?.reasons ?? []) {
    if (/USD|US\$|EUR/.test(reason.label + reason.action))
      failures.push(`moneda extranjera en "${reason.label}"`);
    if (!reason.label || !reason.action) failures.push(`motivo sin texto: ${reason.code}`);
  }
}

if (failures.length > 0) {
  console.error(`check-health: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-health: OK");
