#!/usr/bin/env node
/**
 * Revisa las utilidades de "Editar perfil" (src/components/profile/profileUtils.ts).
 * Uso: node scripts/check-profile.mjs  (o npm run check:profile)
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "profile-check-"));
const outFile = join(outDir, "profileUtils.mjs");

await build({
  entryPoints: [join(root, "src/components/profile/profileUtils.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  logLevel: "error",
});

const u = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
const eq = (name, got, want) => {
  if (got !== want) failures.push(`${name}: esperaba ${want}, obtuvo ${got}`);
};

const empty = {
  agency_legal_name: "",
  agency_tax_id: "",
  agency_address: "",
  agency_email: "",
  agency_business_activity: "",
  agency_website: "",
  agency_instagram: "",
  agency_business_hours: "",
};

eq("iniciales nombre", u.initialsOf("Benjamín Pavez", "x@y.cl"), "BP");
eq("iniciales sin nombre", u.initialsOf("  ", "benja@vibranding.pro"), "BE");

eq("clave corta", u.passwordError("abc", "abc") !== null, true);
eq("claves distintas", u.passwordError("abcdefgh", "abcdefgx"), "Las contraseñas no coinciden.");
eq("clave ok", u.passwordError("abcdefgh", "abcdefgh"), null);

eq("vacío es válido", Object.keys(u.validateAgency(empty)).length, 0);
const bad = u.validateAgency({
  ...empty,
  agency_tax_id: "78.505.344-4",
  agency_email: "hola@",
  agency_website: "no es sitio",
  agency_instagram: "@mal usuario",
});
eq("RUT con DV malo", Boolean(bad.agency_tax_id), true);
eq("email malo", Boolean(bad.agency_email), true);
eq("sitio malo", Boolean(bad.agency_website), true);
eq("instagram malo", Boolean(bad.agency_instagram), true);
const good = u.validateAgency({
  ...empty,
  agency_tax_id: "785053443",
  agency_email: "hola@vibranding.pro",
  agency_website: "vibranding.pro",
  agency_instagram: "@vibranding",
});
eq("datos buenos", Object.keys(good).length, 0);

const input = {
  ...empty,
  agency_tax_id: "785053443",
  agency_website: "vibranding.pro",
  agency_instagram: "@vibranding",
};
const n = u.normalizeAgency(input);
eq("formatea RUT", n.agency_tax_id, "78.505.344-3");
eq("agrega https", n.agency_website, "https://vibranding.pro");
eq("quita @", n.agency_instagram, "vibranding");
eq("no muta la entrada", input.agency_instagram, "@vibranding");
eq(
  "respeta http",
  u.normalizeAgency({ ...empty, agency_website: "http://a.cl" }).agency_website,
  "http://a.cl",
);

if (failures.length > 0) {
  console.error(`check-profile: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-profile: OK");
