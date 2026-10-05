#!/usr/bin/env node
/**
 * Revisa la búsqueda de clientes del header (src/lib/clients/clientSearch.ts).
 * Uso: node scripts/check-client-search.mjs  (o npm run check:client-search)
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "client-search-check-"));
const outFile = join(outDir, "clientSearch.mjs");

await build({
  entryPoints: [join(root, "src/lib/clients/clientSearch.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  logLevel: "error",
});

const s = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
const eq = (name, got, want) => {
  if (got !== want) failures.push(`${name}: esperaba ${want}, obtuvo ${got}`);
};

const clients = [
  {
    id: "a",
    brand: "Proyecta Exteriores",
    legalName: "Proyecta SpA",
    contactName: "José Muñoz",
    status: "activo",
  },
  { id: "b", brand: "Café Ñandú", legalName: null, contactName: null, status: "prospecto" },
  {
    id: "c",
    brand: "Estudio Luz",
    legalName: null,
    contactName: "María Pérez",
    status: "pausado",
  },
];
const ids = (q) =>
  s
    .filterClients(clients, q)
    .map((c) => c.id)
    .join(",");

eq("vacía devuelve todo", ids(""), "a,b,c");
eq("solo espacios devuelve todo", ids("   "), "a,b,c");
eq("por marca", ids("proyecta"), "a");
eq("por razón social", ids("spa"), "a");
eq("por persona sin tilde", ids("jose"), "a");
eq("por persona con tilde", ids("JOSÉ muñoz"), "a");
eq("marca con ñ sin ñ escrita", ids("cafe"), "b");
eq("palabras en distinto orden y campo", ids("perez luz"), "c");
eq("sin coincidencias", ids("zzz"), "");
eq("normaliza", s.normalizeSearchText("  Árbol   ÑU "), "arbol nu");

const copy = [...clients];
s.filterClients(clients, "jose");
eq("no muta la entrada", clients.length === copy.length && clients[0] === copy[0], true);

if (failures.length > 0) {
  console.error(`check-client-search: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-client-search: OK");
