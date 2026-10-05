#!/usr/bin/env node
/**
 * Revisa las preferencias de usuario (src/lib/prefs): zonas horarias, desfases,
 * agrupación, lectura tolerante de user_profiles y formateo por zona.
 * Uso: node scripts/check-prefs.mjs  (o npm run check:prefs)
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "prefs-check-"));
const entry = join(outDir, "entry.ts");
const outFile = join(outDir, "prefs.mjs");
writeFileSync(
  entry,
  ["timezones", "userPrefs", "formatInZone"]
    .map((m) => `export * from ${JSON.stringify(join(root, `src/lib/prefs/${m}.ts`))};`)
    .join("\n"),
);

await build({
  entryPoints: [entry],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  logLevel: "error",
});

const p = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
const eq = (name, got, want) => {
  if (got !== want) failures.push(`${name}: esperaba ${want}, obtuvo ${got}`);
};

// Zonas válidas / inválidas
eq("Madrid válida", p.isValidTimeZone("Europe/Madrid"), true);
eq("Santiago válida", p.isValidTimeZone("America/Santiago"), true);
eq("inventada inválida", p.isValidTimeZone("Mars/Olympus"), false);
eq("vacía inválida", p.isValidTimeZone(""), false);
eq("no string inválida", p.isValidTimeZone(42), false);
eq("inyección inválida", p.isValidTimeZone("Europe/Madrid'; drop"), false);
eq("muy larga inválida", p.isValidTimeZone("A/" + "b".repeat(70)), false);

// Lista completa
const zones = p.listTimeZones();
eq("lista grande", zones.length > 300, true);
eq("incluye Chile", zones.includes("America/Santiago"), true);
eq("incluye Madrid", zones.includes("Europe/Madrid"), true);
eq("incluye UTC", zones.includes("UTC"), true);
eq("sin duplicados", new Set(zones).size, zones.length);

// Desfases (fechas fijas: verano europeo / invierno europeo)
const julio = new Date("2026-07-15T12:00:00Z");
const enero = new Date("2026-01-15T12:00:00Z");
eq("Madrid julio", p.utcOffsetLabel("Europe/Madrid", julio), "UTC+2");
eq("Madrid enero", p.utcOffsetLabel("Europe/Madrid", enero), "UTC+1");
eq("Santiago julio", p.utcOffsetLabel("America/Santiago", julio), "UTC-4");
eq("Santiago enero", p.utcOffsetLabel("America/Santiago", enero), "UTC-3");
eq("Kolkata media hora", p.utcOffsetLabel("Asia/Kolkata", julio), "UTC+5:30");
eq("UTC", p.utcOffsetLabel("UTC", julio), "UTC");
eq("etiqueta", p.timeZoneLabel("Europe/Madrid", julio), "Europe/Madrid (UTC+2)");
eq(
  "etiqueta con espacio",
  p.timeZoneLabel("America/Argentina/Buenos_Aires", julio),
  "America/Argentina/Buenos Aires (UTC-3)",
);

// Agrupación por región
const groups = p.groupTimeZones(["Europe/Madrid", "America/Santiago", "UTC", "Asia/Tokyo"], julio);
eq("primera región", groups[0].region, "América");
eq("segunda región", groups[1].region, "Europa");
eq("última región", groups[groups.length - 1].region, "Otras");
eq(
  "total agrupado",
  groups.reduce((n, g) => n + g.zones.length, 0),
  4,
);

// Buscador: palabras completas, sin tildes, sin coincidencias difusas
const madrid = p.timeZoneSearchValue(
  { id: "Europe/Madrid", label: "Europe/Madrid (UTC+2)" },
  "Europa",
);
const pr = p.timeZoneSearchValue(
  { id: "America/Puerto_Rico", label: "America/Puerto Rico (UTC-4)" },
  "América",
);
eq("busca europe", p.timeZoneSearchScore(madrid, "europe"), 1);
eq("busca europa", p.timeZoneSearchScore(madrid, "Europa"), 1);
eq("busca madrid", p.timeZoneSearchScore(madrid, "MADR"), 1);
eq("busca utc+2", p.timeZoneSearchScore(madrid, "utc+2"), 1);
eq("no difuso", p.timeZoneSearchScore(pr, "europe"), 0);
eq("puerto rico con espacio", p.timeZoneSearchScore(pr, "puerto rico"), 1);
eq("america con tilde", p.timeZoneSearchScore(pr, "américa"), 1);

// Lectura tolerante de user_profiles
const sinMigracion = p.toUserPrefs({ user_id: "u", full_name: "B" });
eq("sin migración: hasPrefs", sinMigracion.hasPrefs, false);
eq("sin migración: zona Chile", sinMigracion.prefs.timeZone, "America/Santiago");
const conMigracion = p.toUserPrefs({ timezone: "Europe/Madrid", language: "en" });
eq("con migración: hasPrefs", conMigracion.hasPrefs, true);
eq("con migración: zona", conMigracion.prefs.timeZone, "Europe/Madrid");
eq("con migración: idioma", conMigracion.prefs.language, "en");
const basura = p.toUserPrefs({ timezone: "Nope/Nope", language: "fr" });
eq("zona inválida → Chile", basura.prefs.timeZone, "America/Santiago");
eq("idioma inválido → es", basura.prefs.language, "es");
eq("sin fila: hasPrefs", p.toUserPrefs(null).hasPrefs, true);
eq("prefsError ok", p.prefsError({ timeZone: "Europe/Madrid", language: "es" }), null);
eq("prefsError zona", p.prefsError({ timeZone: "x", language: "es" }) !== null, true);
eq("prefsError idioma", p.prefsError({ timeZone: "UTC", language: "fr" }) !== null, true);

// Formateo por zona (mismo instante, distinta hora mostrada)
const iso = "2026-07-15T18:30:00Z";
eq("hora Chile", p.formatTimeInZone(iso, "America/Santiago"), "14:30");
eq("hora Madrid", p.formatTimeInZone(iso, "Europe/Madrid"), "20:30");
eq("zona inválida usa Chile", p.formatTimeInZone(iso, "Nope/Nope"), "14:30");
eq("sin valor", p.formatTimeInZone(null, "UTC"), "—");
eq("fecha inválida", p.formatDateTimeInZone("no-es-fecha", "UTC"), "—");
eq(
  "fecha y hora Madrid contiene 20:30",
  p.formatDateTimeInZone(iso, "Europe/Madrid").includes("20:30"),
  true,
);

if (failures.length > 0) {
  console.error("check-prefs: FALLÓ\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log("check-prefs: OK");
