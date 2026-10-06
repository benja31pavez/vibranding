#!/usr/bin/env node
/**
 * Revisa la membresía autogestionada (src/lib/billing/membership.ts).
 * Uso: node scripts/check-membership.mjs
 *
 *  - Estado derivado de los pagos: Activo + Onboarding, Activo, Por renovar,
 *    Finalizado; la renovación encadena el período.
 *  - Qué planes se pueden pagar según el estado (Mantención solo ex clientes).
 *  - Correo de seguimiento: 3 días antes del fin y sin renovación.
 *  - La migración SQL usa los mismos precios netos y planes mensuales que plans.ts.
 *  - Guardia: no queda "permanencia mínima" / "mínimo 3 meses" en src/ ni public/.
 */
import { build } from "esbuild";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "membership-check-"));
const entry = join(outDir, "entry.ts");
const outFile = join(outDir, "membership.mjs");
writeFileSync(
  entry,
  [
    `export * from ${JSON.stringify(join(root, "src/lib/billing/membership.ts"))};`,
    `export * as plans from ${JSON.stringify(join(root, "src/lib/pricing/plans.ts"))};`,
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
const m = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

/** Pago confirmado con el período que le asignaría el trigger. */
function paid(planKey, paidAt, previousEnd = null) {
  const { start, end } = m.nextPeriod(paidAt, previousEnd);
  return {
    status: "paid",
    plan_key: planKey,
    paid_at: paidAt,
    period_start: start,
    period_end: end,
  };
}

const first = paid("contenido", "2026-10-06"); // período 6-oct → 6-nov

// ── Períodos ────────────────────────────────────────────────────────────────
check("período: del día de pago al mismo día del mes siguiente", () => {
  assert.deepEqual(m.nextPeriod("2026-10-06", null), { start: "2026-10-06", end: "2026-11-06" });
  assert.deepEqual(m.nextPeriod("2026-01-31", null), { start: "2026-01-31", end: "2026-02-28" });
  assert.deepEqual(m.nextPeriod("2026-12-15", null), { start: "2026-12-15", end: "2027-01-15" });
});
check("renovación anticipada encadena desde el fin del período vigente", () => {
  assert.deepEqual(m.nextPeriod("2026-11-03", "2026-11-06"), {
    start: "2026-11-06",
    end: "2026-12-06",
  });
  // Renovación después de terminado: parte el día del pago.
  assert.deepEqual(m.nextPeriod("2026-11-20", "2026-11-06"), {
    start: "2026-11-20",
    end: "2026-12-20",
  });
});

// ── Estado derivado ─────────────────────────────────────────────────────────
check("sin pagos de plan → Sin plan vigente", () => {
  const s = m.deriveMembership([], "2026-10-06");
  assert.equal(s.state, "sin_plan");
  assert.equal(s.clientSince, null);
  const pending = { ...first, status: "pending", period_start: null, period_end: null };
  assert.equal(m.deriveMembership([pending], "2026-10-06").state, "sin_plan");
});
check("primer pago, día 0 → Activo + Onboarding; cliente desde = fecha de pago", () => {
  const s = m.deriveMembership([first], "2026-10-06");
  assert.equal(s.state, "activo");
  assert.equal(s.onboarding, true);
  assert.equal(s.clientSince, "2026-10-06");
  assert.equal(s.periodStart, "2026-10-06");
  assert.equal(s.periodEnd, "2026-11-06");
  assert.equal(s.daysLeft, 31);
});
check("día 6 sigue en Onboarding; día 8 → Activo sin Onboarding", () => {
  assert.equal(m.deriveMembership([first], "2026-10-12").onboarding, true);
  const s = m.deriveMembership([first], "2026-10-14");
  assert.equal(s.state, "activo");
  assert.equal(s.onboarding, false);
});
check("3 días antes del fin → Por renovar", () => {
  const s = m.deriveMembership([first], "2026-11-03");
  assert.equal(s.state, "por_renovar");
  assert.equal(s.daysLeft, 3);
  assert.equal(m.deriveMembership([first], "2026-10-31").state, "activo"); // 6 días
  assert.equal(m.deriveMembership([first], "2026-11-01").state, "por_renovar"); // 5 días
});
check("el último día sigue cubierto; el día siguiente al fin → Finalizado (ex cliente)", () => {
  const last = m.deriveMembership([first], "2026-11-06");
  assert.equal(last.state, "por_renovar");
  assert.equal(last.daysLeft, 0);
  const s = m.deriveMembership([first], "2026-11-07");
  assert.equal(s.state, "finalizado");
  assert.equal(s.formerClient, true);
  assert.equal(s.planKey, "contenido");
  assert.equal(s.clientSince, "2026-10-06");
  assert.equal(m.isActiveMembership(s), false);
});
check("renovación encadena: vuelve a Activo y cubre hasta el mes siguiente", () => {
  const renewal = paid("contenido", "2026-11-03", first.period_end);
  const s = m.deriveMembership([first, renewal], "2026-11-04");
  assert.equal(s.state, "activo");
  assert.equal(s.renewed, true);
  assert.equal(s.coveredUntil, "2026-12-06");
  assert.equal(s.periodEnd, "2026-11-06");
  assert.equal(s.onboarding, false);
  const later = m.deriveMembership([first, renewal], "2026-11-10");
  assert.equal(later.periodStart, "2026-11-06");
  assert.equal(later.renewed, false);
});
check("pagos cancelados o pendientes no cuentan", () => {
  const cancelled = { ...first, status: "cancelled" };
  assert.equal(m.deriveMembership([cancelled], "2026-10-10").state, "sin_plan");
});

// ── Qué se puede pagar ──────────────────────────────────────────────────────
const keys = (s) => m.purchasablePlans(s).map((p) => p.key);
check("sin plan: solo planes públicos (nunca Mantención)", () => {
  assert.deepEqual(keys(m.deriveMembership([], "2026-10-06")), [
    "marca-web",
    "contenido",
    "crecimiento",
  ]);
});
check("activo: no se cambia de plan durante el período pagado", () => {
  const s = m.deriveMembership([first], "2026-10-20");
  assert.deepEqual(keys(s), []);
  assert.ok(m.purchaseBlockedReason(s, "crecimiento"));
});
check("por renovar: el mismo plan; desde Marca + Web, un plan mensual público", () => {
  assert.deepEqual(keys(m.deriveMembership([first], "2026-11-03")), ["contenido"]);
  const web = paid("marca-web", "2026-10-06");
  assert.deepEqual(keys(m.deriveMembership([web], "2026-11-03")), ["contenido", "crecimiento"]);
});
check("finalizado (ex cliente): puede elegir Mantención u otro", () => {
  const s = m.deriveMembership([first], "2026-12-01");
  assert.deepEqual(keys(s), ["marca-web", "contenido", "crecimiento", "mantencion"]);
  assert.equal(m.canPurchase(m.deriveMembership([], "2026-10-06"), "mantencion"), false);
});

// ── MRR y seguimiento ───────────────────────────────────────────────────────
check("MRR neto = precio del plan mensual vigente; Marca + Web y finalizado = 0", () => {
  assert.equal(m.membershipMrr(m.deriveMembership([first], "2026-10-10")), 129_990);
  assert.equal(m.membershipMrr(m.deriveMembership([first], "2026-12-01")), 0);
  const web = paid("marca-web", "2026-10-06");
  assert.equal(m.membershipMrr(m.deriveMembership([web], "2026-10-10")), 0);
});
check("seguimiento: 3 días antes del fin, una vez y solo sin renovación", () => {
  assert.equal(m.followupDue(m.deriveMembership([first], "2026-11-02"), false), false);
  assert.equal(m.followupDue(m.deriveMembership([first], "2026-11-03"), false), true);
  assert.equal(m.followupDue(m.deriveMembership([first], "2026-11-03"), true), false);
  const renewal = paid("contenido", "2026-11-03", first.period_end);
  assert.equal(m.followupDue(m.deriveMembership([first, renewal], "2026-11-04"), false), false);
});
check("correo de seguimiento: servicio, con link y sin cobro automático", () => {
  const mail = m.buildFollowupEmail({
    clientName: "Panadería Sol",
    contactName: "Ana",
    planLabel: "Plan Contenido",
    periodEnd: "2026-11-06",
    renewUrl: "https://vibranding.pro/clients/x/facturacion",
    oneTime: false,
  });
  const text = mail.lines.join("\n");
  assert.match(mail.subject, /6 nov 2026/);
  assert.match(text, /Hola Ana,/);
  assert.match(text, /https:\/\/vibranding\.pro\/clients\/x\/facturacion/);
  assert.match(text, /No hay cobros automáticos/);
});

// ── SQL = plans.ts ──────────────────────────────────────────────────────────
const MIGRATION = "supabase/migrations/20261012002500_membresia_autogestionada.sql";
check("la migración usa los mismos precios netos y planes mensuales", () => {
  const sql = readFileSync(join(root, MIGRATION), "utf8");
  for (const plan of m.plans.PLANS) {
    assert.match(sql, new RegExp(`WHEN '${plan.key}' THEN ${plan.netPrice}\\b`), plan.key);
  }
  const monthly = m.plans.PLANS.filter((p) => p.billing === "monthly").map((p) => `'${p.key}'`);
  assert.ok(sql.includes(`_plan_key IN (${monthly.join(", ")})`), "plan_is_monthly");
  assert.ok(sql.includes(`- _today <= ${m.RENEW_WINDOW_DAYS} THEN 'por_renovar'`), "ventana");
  assert.ok(sql.includes(`_today - (SELECT since FROM agg) < ${m.ONBOARDING_DAYS}`), "onboarding");
});

// ── Guardia de permanencia ──────────────────────────────────────────────────
const SCAN_EXT = new Set([".ts", ".tsx", ".txt", ".md", ".html"]);
const SKIP_DIRS = new Set(["node_modules", "integrations"]);
const PERMANENCE = /m[ií]n(imo|\.)\s*(de\s*)?\d+\s*meses|permanencia m[ií]nima (de\b|:)|minMonths/i;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(name)) yield* walk(path);
    } else if (SCAN_EXT.has(extname(name))) {
      yield path;
    }
  }
}

check('sin "mínimo N meses" ni "permanencia mínima de" en src/ ni public/', () => {
  const hits = [];
  for (const base of ["src", "public"]) {
    for (const file of walk(join(root, base))) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, idx) => {
          if (PERMANENCE.test(line)) hits.push(`${relative(root, file)}:${idx + 1}`);
        });
    }
  }
  assert.deepEqual(hits, []);
});

if (failures.length > 0) {
  console.error(`check-membership: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-membership: OK");
