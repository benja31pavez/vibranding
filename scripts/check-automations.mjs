#!/usr/bin/env node
/**
 * Revisa el estado de automatizaciones (src/lib/automations/status.ts):
 * mapeo job → grupo, horario en hora de Chile, saneo de errores y estados.
 * Uso: node scripts/check-automations.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "automations-check-"));
const outFile = join(outDir, "status.mjs");

await build({
  entryPoints: [join(root, "src/lib/automations/status.ts")],
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
function check(name, fn) {
  try {
    fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

// Octubre: Chile en horario de verano (UTC-3). Julio: invierno (UTC-4).
const NOW = new Date("2026-10-20T15:00:00Z");
const WINTER = new Date("2026-07-15T15:00:00Z");
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const job = (name, over = {}) => ({
  name,
  active: true,
  schedule: "0 13 * * *",
  latest: null,
  ...over,
});
const run = (status, h, error = null) => ({ status, startedAt: hoursAgo(h), error });

// Mapeo de jobs (nombres reales de las migraciones)
check("campaign_alerts_* → Alertas", () => {
  for (const n of ["campaign_alerts_0", "campaign_alerts_8", "campaign_alerts_32"])
    assert.equal(s.groupForJob(n).id, "campaign_alerts");
});
check("monthly_reports_* → Reporte mensual", () =>
  assert.equal(s.groupForJob("monthly_reports_15").id, "monthly_reports"),
);
check("billing_monthly_charges → Cobro mensual", () =>
  assert.equal(s.groupForJob("billing_monthly_charges").id, "billing"),
);
check("meta_insights_daily → Ingesta Meta", () =>
  assert.equal(s.groupForJob("meta_insights_daily").id, "meta_ingest"),
);
check("google_ads_ingest_* → Ingesta Google Ads", () =>
  assert.equal(s.groupForJob("google_ads_ingest_16").id, "google_ads_ingest"),
);
check("onboarding_cleanup → Limpieza onboarding", () =>
  assert.equal(s.groupForJob("onboarding_cleanup").id, "onboarding_cleanup"),
);
check("whatsapp_ai_dispatch → Bot de WhatsApp", () =>
  assert.equal(s.groupForJob("whatsapp_ai_dispatch").id, "whatsapp_dispatch"),
);
check("prefijo parcial no engaña", () =>
  assert.equal(s.groupForJob("campaign_alertsX").id, "other"),
);
check("desconocido → Otras", () => assert.equal(s.groupForJob("algo_nuevo").id, "other"));
check("todos los grupos tienen texto en español", () => {
  for (const g of s.AUTOMATION_GROUPS) assert.ok(g.label && g.description.length > 20, g.id);
});

// Horario en hora de Chile
check("diario 13:00 UTC = 10:00 Chile (verano)", () =>
  assert.equal(s.describeSchedule("0 13 * * *", NOW).label, "Todos los días a las 10:00"),
);
check("diario 13:00 UTC = 09:00 Chile (invierno)", () =>
  assert.equal(s.describeSchedule("0 13 * * *", WINTER).label, "Todos los días a las 09:00"),
);
check("mensual día 1", () =>
  assert.equal(s.describeSchedule("0 12 1 * *", NOW).label, "El día 1 de cada mes a las 09:00"),
);
check("cada 2 minutos", () =>
  assert.equal(s.describeSchedule("*/2 * * * *", NOW).label, "Cada 2 minutos"),
);
check("segundos", () =>
  assert.equal(s.describeSchedule("30 seconds", NOW).label, "Cada 30 segundos"),
);
check("sin horario = No programada", () =>
  assert.equal(s.describeSchedule(null, NOW).label, "No programada"),
);
check("lotes diarios = rango", () =>
  assert.equal(
    s.describeGroupSchedule(["0 13 * * *", "3 13 * * *", "12 13 * * *"], NOW),
    "Todos los días, 10:00–10:12 (3 lotes)",
  ),
);
check("lotes mensuales = rango", () =>
  assert.equal(
    s.describeGroupSchedule(["0 12 1 * *", "10 12 1 * *"], NOW),
    "El día 1 de cada mes, 09:00–09:10 (2 lotes)",
  ),
);

// Saneo de errores: sin URLs, tokens ni HTML; truncado
check("quita URL con token", () => {
  const out = s.sanitizeError("fetch failed https://vibranding.pro/api/x?token=abc123&secret=zzz");
  assert.ok(
    !out.includes("vibranding.pro") && !out.includes("abc123") && !out.includes("zzz"),
    out,
  );
});
check("quita JWT y bearer", () => {
  const out = s.sanitizeError(
    "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl rechazado",
  );
  assert.ok(!out.includes("eyJ") && !out.includes("c2lnbmF0dXJl"), out);
});
check("quita secret=valor", () =>
  assert.ok(
    !s.sanitizeError("x-dispatch-secret=superSecreto99 inválido").includes("superSecreto99"),
  ),
);
check("quita cadenas largas tipo clave", () =>
  assert.ok(
    !s.sanitizeError("key sk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 falló").includes("ABCDEFGHIJ"),
  ),
);
check("HTML → texto", () =>
  assert.equal(
    s.sanitizeError("<html><body><h1>502 Bad Gateway</h1></body></html>"),
    "502 Bad Gateway",
  ),
);
check("JSON → mensaje", () =>
  assert.equal(s.sanitizeError('{"error":"Meta token expirado"}'), "Meta token expirado"),
);
check("timeout conocido en español", () =>
  assert.equal(
    s.sanitizeError("no HTTP response recorded (timeout)"),
    "Sin respuesta del servidor (tiempo agotado).",
  ),
);
check("trunca", () => {
  const out = s.sanitizeError("error ".repeat(100));
  assert.ok(out.length <= s.ERROR_MAX_LENGTH && out.endsWith("…"), String(out.length));
});
check("vacío = null", () => {
  assert.equal(s.sanitizeError(null), null);
  assert.equal(s.sanitizeError("   "), null);
});

// Estado por grupo
const alerts = s.AUTOMATION_GROUPS.find((g) => g.id === "campaign_alerts");
const monthly = s.AUTOMATION_GROUPS.find((g) => g.id === "monthly_reports");
const whatsapp = s.AUTOMATION_GROUPS.find((g) => g.id === "whatsapp_dispatch");
check("ok", () =>
  assert.equal(
    s.deriveGroupStatus(alerts, [job("campaign_alerts_0", { latest: run("succeeded", 2) })], NOW),
    "ok",
  ),
);
check("no_data cuenta como ok", () =>
  assert.equal(
    s.deriveGroupStatus(alerts, [job("campaign_alerts_32", { latest: run("no_data", 2) })], NOW),
    "ok",
  ),
);
check("un lote fallido = con errores", () =>
  assert.equal(
    s.deriveGroupStatus(
      alerts,
      [
        job("campaign_alerts_0", { latest: run("succeeded", 2) }),
        job("campaign_alerts_8", { latest: run("failed", 2) }),
      ],
      NOW,
    ),
    "error",
  ),
);
check("diario sin correr 30 h = atrasada", () =>
  assert.equal(
    s.deriveGroupStatus(alerts, [job("campaign_alerts_0", { latest: run("succeeded", 30) })], NOW),
    "late",
  ),
);
check("diario desactivado no se marca atrasado", () =>
  assert.equal(
    s.deriveGroupStatus(
      alerts,
      [job("campaign_alerts_0", { active: false, latest: run("succeeded", 30) })],
      NOW,
    ),
    "ok",
  ),
);
check("mensual hace 20 días = ok", () =>
  assert.equal(
    s.deriveGroupStatus(
      monthly,
      [job("monthly_reports_0", { latest: run("succeeded", 20 * 24) })],
      NOW,
    ),
    "ok",
  ),
);
check("sin ejecuciones = sin ejecutar", () =>
  assert.equal(s.deriveGroupStatus(alerts, [job("campaign_alerts_0")], NOW), "never"),
);
check("bajo demanda sin correr días = ok", () =>
  assert.equal(
    s.deriveGroupStatus(
      whatsapp,
      [job("whatsapp_ai_dispatch", { latest: run("succeeded", 24 * 5) })],
      NOW,
    ),
    "ok",
  ),
);

// Reporte completo
const counts = {
  campaign_alerts: {
    total7d: 35,
    failed7d: 2,
    lastError: { error: "https://x.y/z?token=abc falló", startedAt: hoursAgo(50) },
  },
};
const allOk = [
  job("campaign_alerts_0", { latest: run("succeeded", 2) }),
  job("monthly_reports_0", { schedule: "0 12 1 * *", latest: run("succeeded", 19 * 24) }),
  job("billing_monthly_charges", { schedule: "30 13 * * *", latest: run("succeeded", 1) }),
  job("meta_insights_daily", { schedule: "20 6 * * *", latest: run("succeeded", 9) }),
  job("google_ads_ingest_0", { schedule: "40 6 * * *", latest: run("no_data", 8) }),
  job("onboarding_cleanup", { schedule: "0 7 * * *", latest: run("succeeded", 8) }),
  job("whatsapp_ai_dispatch", { schedule: "*/2 * * * *" }),
];
check("todo al día = Todo en orden", () => {
  const r = s.buildAutomationsReport(allOk, counts, NOW);
  assert.equal(r.overall, "ok");
  assert.equal(r.overallLabel, "Todo en orden");
  assert.deepEqual(r.attention, []);
});
check("grupo ok con fallos recientes muestra error saneado y nota", () => {
  const g = s
    .buildAutomationsReport(allOk, counts, NOW)
    .groups.find((x) => x.id === "campaign_alerts");
  assert.equal(g.runs7d, 35);
  assert.equal(g.failed7d, 2);
  assert.ok(
    g.lastError && !g.lastError.includes("token=abc") && !g.lastError.includes("x.y"),
    g.lastError,
  );
  assert.match(g.note ?? "", /2 fallo/);
});
check("grupos definidos siempre aparecen", () => {
  const r = s.buildAutomationsReport([], {}, NOW);
  assert.equal(r.groups.length, s.AUTOMATION_GROUPS.length);
  assert.equal(r.groups.find((g) => g.id === "billing").schedule, "No programada");
});
check("diario no programado ni ejecutado = Revisar", () => {
  const r = s.buildAutomationsReport(
    allOk.filter((j) => j.name !== "onboarding_cleanup"),
    {},
    NOW,
  );
  assert.equal(r.overall, "warning");
  assert.deepEqual(r.attention, ["Limpieza onboarding"]);
  assert.match(
    r.groups.find((g) => g.id === "onboarding_cleanup").note ?? "",
    /No está programada/,
  );
});
check("fallo = Con errores", () => {
  const jobs = allOk.map((j) =>
    j.name === "meta_insights_daily" ? { ...j, latest: run("failed", 9, "<h1>500</h1>") } : j,
  );
  const r = s.buildAutomationsReport(jobs, {}, NOW);
  assert.equal(r.overall, "error");
  const g = r.groups.find((x) => x.id === "meta_ingest");
  assert.equal(g.statusLabel, "Con errores");
  assert.equal(g.lastError, "500");
});
check("job desconocido va a Otras tareas", () => {
  const r = s.buildAutomationsReport(
    [...allOk, job("mark_overdue_payments", { latest: run("succeeded", 3) })],
    {},
    NOW,
  );
  assert.equal(r.groups.at(-1).id, "other");
});
check("whatsapp sin correr no alarma", () => {
  const g = s
    .buildAutomationsReport(allOk, {}, NOW)
    .groups.find((x) => x.id === "whatsapp_dispatch");
  assert.equal(g.status, "never");
  assert.equal(g.needsAttention, false);
});
check("nada ejecutado nunca = Revisar (no 'Todo en orden')", () => {
  const r = s.buildAutomationsReport([], {}, NOW);
  assert.equal(r.overall, "warning");
});
check("sin grupos = Sin información", () => assert.equal(s.overallStatus([]), "unknown"));

if (failures.length > 0) {
  console.error(`check-automations: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-automations: OK");
