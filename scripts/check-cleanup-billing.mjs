#!/usr/bin/env node
/**
 * Revisa los helpers puros de la limpieza del onboarding en dos fases
 * (src/lib/onboarding/cleanup.ts) y del tope de "ponerse al día" del cobro
 * recurrente (src/lib/billing/catchUp.ts).
 * Uso: node scripts/check-cleanup-billing.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "cleanup-billing-check-"));

async function load(entry, name) {
  const outfile = join(outDir, `${name}.mjs`);
  await build({
    entryPoints: [join(root, entry)],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    alias: { "@": join(root, "src") },
    logLevel: "error",
  });
  return import(pathToFileURL(outfile).href);
}

const c = await load("src/lib/onboarding/cleanup.ts", "cleanup");
const b = await load("src/lib/billing/catchUp.ts", "catchUp");
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

// --- limpieza del onboarding ---
check("RPC inexistente = fallback", () => {
  assert.equal(c.isMissingRpcError({ code: "PGRST202" }), true);
  assert.equal(c.isMissingRpcError({ code: "42883" }), true);
  assert.equal(c.isMissingRpcError({ code: "42501" }), false);
  assert.equal(c.isMissingRpcError(null), false);
});
check("filas: descarta basura y deduplica", () => {
  const rows = c.parseOrphanRows([
    { path: "a/1", reason: "reserva_vencida" },
    { path: "a/1", reason: "sin_reserva" },
    { path: "", reason: "x" },
    { path: 3 },
    null,
    { path: "a/2" },
  ]);
  assert.deepEqual(rows, [
    { path: "a/1", reason: "reserva_vencida" },
    { path: "a/2", reason: "desconocido" },
  ]);
  assert.deepEqual(c.parseOrphanRows({ no: "array" }), []);
});
check("conteo por razón", () =>
  assert.deepEqual(
    c.countReasons([
      { path: "1", reason: "sin_reserva" },
      { path: "2", reason: "reserva_vencida" },
      { path: "3", reason: "sin_reserva" },
    ]),
    { sin_reserva: 2, reserva_vencida: 1 },
  ),
);
check("lotes con tope", () => {
  const items = Array.from({ length: 250 }, (_, i) => i);
  const batches = c.chunk(items, 100, 2);
  assert.equal(batches.length, 2);
  assert.equal(batches[1].length, 100);
  assert.deepEqual(c.chunk([], 100, 20), []);
  assert.deepEqual(c.chunk([1, 2, 3], 2, 20), [[1, 2], [3]]);
});
check("solo se borran reservas de lotes que Storage completó", () => {
  const rows = [
    { path: "a/1", reason: "reserva_vencida" },
    { path: "a/2", reason: "reserva_vencida" },
    { path: "a/3", reason: "sin_reserva" },
  ];
  assert.deepEqual(c.reservationPathsToDelete(rows, new Set(["a/1", "a/3"])), ["a/1"]);
  assert.deepEqual(c.reservationPathsToDelete(rows, new Set()), []);
});

// --- ponerse al día del cobro recurrente ---
const TODAY = "2026-10-05";
check("tope de 2 períodos por corrida", () => {
  assert.equal(b.MAX_CATCH_UP_PERIODS, 2);
  assert.equal(b.shouldContinueCatchUp(0, "2026-06-05", TODAY), true);
  assert.equal(b.shouldContinueCatchUp(1, "2026-07-05", TODAY), true);
  assert.equal(b.shouldContinueCatchUp(2, "2026-08-05", TODAY), false);
  assert.equal(b.shouldContinueCatchUp(0, "2026-11-05", TODAY), false);
});
check("un cobro al día no genera aviso", () =>
  assert.deepEqual(
    b.catchUpNotices(
      [
        {
          subscriptionId: "s",
          clientId: "c",
          created: ["2026-10-01"],
          nextChargeDate: "2026-11-05",
        },
      ],
      TODAY,
    ),
    [],
  ),
);
check("dos cobros y aún atrasada = aviso pendiente", () => {
  const [n] = b.catchUpNotices(
    [
      {
        subscriptionId: "s",
        clientId: "c",
        created: ["2026-06-01", "2026-07-01"],
        nextChargeDate: "2026-08-05",
      },
    ],
    TODAY,
  );
  assert.equal(n.pending, true);
  assert.deepEqual(n.created, ["2026-06-01", "2026-07-01"]);
});
check("con error no se marca pendiente ni avisa sin cobros", () =>
  assert.deepEqual(
    b.catchUpNotices(
      [
        {
          subscriptionId: "s",
          clientId: "c",
          created: [],
          nextChargeDate: "2026-01-05",
          error: "x",
        },
      ],
      TODAY,
    ),
    [],
  ),
);
check("tag del log", () => assert.equal(b.CATCH_UP_LOG_TAG, "[billing][ponerse_al_dia]"));

if (failures.length > 0) {
  console.error(`check-cleanup-billing: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-cleanup-billing: OK");
