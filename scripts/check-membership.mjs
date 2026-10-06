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

/** Pago confirmado con el período que le asignaría el trigger (encadena con `prev`). */
function paid(planKey, paidAt, prev = null) {
  const spec = m.nextPeriod(
    paidAt,
    prev ? { end: prev.period_end, anchorDay: prev.period_anchor_day } : null,
  );
  return {
    status: "paid",
    plan_key: planKey,
    paid_at: paidAt,
    period_start: spec.start,
    period_end: spec.end,
    period_anchor_day: spec.anchorDay,
  };
}
/** Marca + Web: pago único, sin período. */
const web = (paidAt) => ({
  status: "paid",
  plan_key: "marca-web",
  paid_at: paidAt,
  period_start: null,
  period_end: null,
});

const first = paid("contenido", "2026-10-06"); // 6-oct → 5-nov (incluido)

// ── Períodos ────────────────────────────────────────────────────────────────
check("período: [inicio, inicio + 1 mes - 1 día], inclusivo", () => {
  assert.deepEqual(m.nextPeriod("2026-10-06", null), {
    start: "2026-10-06",
    end: "2026-11-05",
    anchorDay: 6,
  });
  assert.deepEqual(m.nextPeriod("2026-12-15", null), {
    start: "2026-12-15",
    end: "2027-01-14",
    anchorDay: 15,
  });
});
check("31-ene encadenado: ancla 31, sin solape ni deriva", () => {
  const p1 = paid("contenido", "2026-01-31");
  assert.equal(p1.period_end, "2026-02-27");
  const p2 = paid("contenido", "2026-02-25", p1);
  assert.deepEqual([p2.period_start, p2.period_end], ["2026-02-28", "2026-03-30"]);
  const p3 = paid("contenido", "2026-03-28", p2);
  assert.deepEqual([p3.period_start, p3.period_end], ["2026-03-31", "2026-04-29"]);
  const p4 = paid("contenido", "2026-04-29", p3);
  assert.deepEqual([p4.period_start, p4.period_end], ["2026-04-30", "2026-05-30"]);
  assert.equal(p4.period_anchor_day, 31);
});
check("renovar antes de vencer: parte el día siguiente al fin", () => {
  const r = paid("contenido", "2026-11-02", first);
  assert.deepEqual([r.period_start, r.period_end], ["2026-11-06", "2026-12-05"]);
});
check("renovar el mismo día del fin: también encadena", () => {
  const r = paid("contenido", "2026-11-05", first);
  assert.deepEqual([r.period_start, r.period_end], ["2026-11-06", "2026-12-05"]);
});
check("renovar después de vencer: parte el día del pago con ancla nueva", () => {
  const r = paid("contenido", "2026-11-20", first);
  assert.deepEqual(
    [r.period_start, r.period_end, r.period_anchor_day],
    ["2026-11-20", "2026-12-19", 20],
  );
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
  assert.equal(s.periodEnd, "2026-11-05");
  assert.equal(s.daysLeft, 30);
});
check("día 6 sigue en Onboarding; día 8 → Activo sin Onboarding", () => {
  assert.equal(m.deriveMembership([first], "2026-10-12").onboarding, true);
  const s = m.deriveMembership([first], "2026-10-14");
  assert.equal(s.state, "activo");
  assert.equal(s.onboarding, false);
});
check("3 días antes del fin → Por renovar", () => {
  const s = m.deriveMembership([first], "2026-11-02");
  assert.equal(s.state, "por_renovar");
  assert.equal(s.daysLeft, 3);
  assert.equal(m.deriveMembership([first], "2026-10-30").state, "activo"); // 6 días
  assert.equal(m.deriveMembership([first], "2026-10-31").state, "por_renovar"); // 5 días
});
check("el último día sigue cubierto; el día siguiente al fin → Finalizado (ex cliente)", () => {
  const last = m.deriveMembership([first], "2026-11-05");
  assert.equal(last.state, "por_renovar");
  assert.equal(last.daysLeft, 0);
  const s = m.deriveMembership([first], "2026-11-06");
  assert.equal(s.state, "finalizado");
  assert.equal(s.formerClient, true);
  assert.equal(s.planKey, "contenido");
  assert.equal(s.clientSince, "2026-10-06");
  assert.equal(m.isActiveMembership(s), false);
});
check("renovación encadena: vuelve a Activo y cubre el mes siguiente", () => {
  const renewal = paid("contenido", "2026-11-02", first);
  const s = m.deriveMembership([first, renewal], "2026-11-03");
  assert.equal(s.state, "activo");
  assert.equal(s.renewed, true);
  assert.equal(s.coveredUntil, "2026-12-05");
  assert.equal(s.periodEnd, "2026-11-05");
  assert.equal(s.onboarding, false);
  const later = m.deriveMembership([first, renewal], "2026-11-10");
  assert.equal(later.periodStart, "2026-11-06");
  assert.equal(later.renewed, false);
});
check("pagos cancelados o pendientes no cuentan", () => {
  const cancelled = { ...first, status: "cancelled" };
  assert.equal(m.deriveMembership([cancelled], "2026-10-10").state, "sin_plan");
});
check("Marca + Web: pago único sin vencimiento (nunca Por renovar ni Finalizado)", () => {
  for (const day of ["2026-10-06", "2026-11-03", "2027-06-01"]) {
    const s = m.deriveMembership([web("2026-10-06")], day);
    assert.equal(s.state, "pago_unico", day);
    assert.equal(s.oneTimePaidAt, "2026-10-06");
    assert.equal(s.coveredUntil, null);
    assert.equal(m.followupDue(s, false), false);
  }
  assert.equal(m.deriveMembership([web("2026-10-06")], "2026-10-08").onboarding, true);
  // Marca + Web y luego un plan mensual: manda el plan mensual.
  const s = m.deriveMembership([web("2026-10-06"), paid("contenido", "2026-10-20")], "2026-10-25");
  assert.equal(s.state, "activo");
  assert.equal(s.clientSince, "2026-10-06");
  assert.equal(s.oneTimePaidAt, "2026-10-06");
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
check("pago único: un plan mensual público para continuar", () => {
  assert.deepEqual(keys(m.deriveMembership([web("2026-10-06")], "2026-11-03")), [
    "contenido",
    "crecimiento",
  ]);
});
check("activo: no se cambia de plan durante el período pagado", () => {
  const s = m.deriveMembership([first], "2026-10-20");
  assert.deepEqual(keys(s), []);
  assert.ok(m.purchaseBlockedReason(s, "crecimiento"));
});
check("por renovar: el mismo plan", () => {
  assert.deepEqual(keys(m.deriveMembership([first], "2026-11-02")), ["contenido"]);
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
  assert.equal(m.membershipMrr(m.deriveMembership([web("2026-10-06")], "2026-10-10")), 0);
});
check("seguimiento: 3 días antes del fin, una vez y solo sin renovación", () => {
  assert.equal(m.followupDue(m.deriveMembership([first], "2026-11-01"), false), false);
  assert.equal(m.followupDue(m.deriveMembership([first], "2026-11-02"), false), true);
  assert.equal(m.followupDue(m.deriveMembership([first], "2026-11-02"), true), false);
  const renewal = paid("contenido", "2026-11-02", first);
  assert.equal(m.followupDue(m.deriveMembership([first, renewal], "2026-11-03"), false), false);
});
check("correo de seguimiento: servicio, con link y sin cobro automático", () => {
  const mail = m.buildFollowupEmail({
    clientName: "Panadería Sol",
    contactName: "Ana",
    planLabel: "Plan Contenido",
    periodEnd: "2026-11-05",
    renewUrl: "https://vibranding.pro/clients/x/facturacion",
  });
  const text = mail.lines.join("\n");
  assert.match(mail.subject, /5 nov 2026/);
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
  assert.ok(
    sql.includes("NEW.period_start := prev_end + 1;"),
    "renovación encadena al día siguiente",
  );
  assert.ok(sql.includes("paid <= prev_end"), "renovar el mismo día del fin encadena");
  assert.ok(sql.includes("coalesce(NEW.provider, '') <> 'flow'"), "solo Flow activa un plan");
  assert.ok(sql.includes("SET LOCAL lock_timeout = '5s'"), "lock_timeout");
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
