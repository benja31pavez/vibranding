#!/usr/bin/env node
/**
 * Revisa los cálculos de las listas "a pantalla" (src/lib/layout/fitList.ts).
 * Uso: node scripts/check-fit-list.mjs  (o npm run check:fit-list)
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "fit-list-check-"));
const outFile = join(outDir, "fitList.mjs");

await build({
  entryPoints: [join(root, "src/lib/layout/fitList.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  logLevel: "error",
});

const f = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
const eq = (name, got, want) => {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) failures.push(`${name}: esperaba ${b}, obtuvo ${a}`);
};

// fitCount
eq("fitCount exacto", f.fitCount({ available: 300, rowHeight: 60 }), 5);
eq("fitCount con gap", f.fitCount({ available: 300, rowHeight: 60, gap: 8 }), 4);
eq("fitCount gap justo", f.fitCount({ available: 332, rowHeight: 60, gap: 8 }), 5);
eq("fitCount no cabe ninguno → mínimo 1", f.fitCount({ available: 20, rowHeight: 60 }), 1);
eq("fitCount mínimo propio", f.fitCount({ available: 20, rowHeight: 60, min: 0 }), 0);
eq("fitCount alto negativo", f.fitCount({ available: -50, rowHeight: 60 }), 1);
eq("fitCount fila 0 → mínimo", f.fitCount({ available: 300, rowHeight: 0 }), 1);
eq("fitCount NaN → mínimo", f.fitCount({ available: Number.NaN, rowHeight: 40 }), 1);

// gridFit
eq(
  "gridFit 3×2",
  f.gridFit({ width: 960, height: 300, minColWidth: 280, rowHeight: 120, gap: 12 }),
  { cols: 3, rows: 2, pageSize: 6 },
);
eq(
  "gridFit maxCols",
  f.gridFit({ width: 2000, height: 120, minColWidth: 200, rowHeight: 120, maxCols: 4 }),
  { cols: 4, rows: 1, pageSize: 4 },
);
eq(
  "gridFit angosto → 1 col",
  f.gridFit({ width: 100, height: 0, minColWidth: 280, rowHeight: 120 }),
  {
    cols: 1,
    rows: 1,
    pageSize: 1,
  },
);

// paginate
eq("paginate primera", f.paginate(23, 5, 0), { page: 0, pageCount: 5, start: 0, end: 5 });
eq("paginate última incompleta", f.paginate(23, 5, 4), {
  page: 4,
  pageCount: 5,
  start: 20,
  end: 23,
});
eq("paginate fuera de rango se acota", f.paginate(23, 5, 9), {
  page: 4,
  pageCount: 5,
  start: 20,
  end: 23,
});
eq("paginate negativa", f.paginate(23, 5, -2), { page: 0, pageCount: 5, start: 0, end: 5 });
eq("paginate vacía", f.paginate(0, 5, 3), { page: 0, pageCount: 1, start: 0, end: 0 });
eq("paginate tamaño 0 → 1", f.paginate(3, 0, 1), { page: 1, pageCount: 3, start: 1, end: 2 });

// pageForIndex
eq("pageForIndex mantiene ítem", f.pageForIndex(12, 5), 2);
eq("pageForIndex tamaño mayor", f.pageForIndex(12, 20), 0);

// pagerItems
eq("pager 1 página", f.pagerItems(1, 0), []);
eq("pager 3 páginas", f.pagerItems(3, 0), [1, 2, 3]);
eq("pager 10 en la 5", f.pagerItems(10, 4), [1, "gap", 4, 5, 6, "gap", 10]);
eq("pager 10 en la 1", f.pagerItems(10, 0), [1, 2, "gap", 10]);
eq("pager 10 en la 3 (sin gap de 1)", f.pagerItems(10, 2), [1, 2, 3, 4, "gap", 10]);
eq("pager actual fuera de rango", f.pagerItems(4, 9), [1, 2, 3, 4]);

if (failures.length > 0) {
  console.error(`check-fit-list: ${failures.length} fallo(s)`);
  for (const msg of failures) console.error(`  ✗ ${msg}`);
  process.exit(1);
}
console.log("check-fit-list: OK");
