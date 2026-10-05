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

// Cambio de contraseña con código enviado al email.
eq("otp limpia espacios", u.sanitizeOtp("123 456"), "123456");
eq("otp corta a 6", u.sanitizeOtp("12345678"), "123456");
eq("otp solo dígitos", u.sanitizeOtp("ab12c3"), "123");
eq("otp válido", u.isValidOtp("004567"), true);
eq("otp corto", u.isValidOtp("12345"), false);
eq("otp con letras", u.isValidOtp("12345a"), false);
eq("otp largo", u.isValidOtp("1234567"), false);
const sinCodigo = u.validatePasswordChange("12", "abcdefgh", "abcdefgh");
eq("paso 2 sin código", Boolean(sinCodigo.code) && !sinCodigo.password, true);
eq("paso 2 clave corta", Boolean(u.validatePasswordChange("123456", "abc", "abc").password), true);
eq(
  "paso 2 no coinciden",
  u.validatePasswordChange("123456", "abcdefgh", "abcdefgx").password,
  "Las contraseñas no coinciden.",
);
eq("paso 2 ambos malos", Object.keys(u.validatePasswordChange("", "a", "b")).length, 2);
eq("paso 2 ok", Object.keys(u.validatePasswordChange("123456", "abcdefgh", "abcdefgh")).length, 0);
eq("reenvío sin envío previo", u.resendSecondsLeft(null, 1000), 0);
eq("reenvío recién enviado", u.resendSecondsLeft(1000, 1000), u.RESEND_COOLDOWN_SECONDS);
eq("reenvío a los 59,5 s", u.resendSecondsLeft(0, 59_500), 1);
eq("reenvío a los 60 s", u.resendSecondsLeft(0, 60_000), 0);
eq(
  "límite de envíos",
  u.sendCodeErrorMessage({ code: "over_email_send_rate_limit" }),
  u.RATE_LIMIT_MESSAGE,
);
eq("límite por status 429", u.sendCodeErrorMessage({ status: 429 }), u.RATE_LIMIT_MESSAGE);
eq("envío falla genérico", u.sendCodeErrorMessage({ status: 500 }) !== u.RATE_LIMIT_MESSAGE, true);
eq(
  "código vencido",
  u.changePasswordErrorMessage({ code: "reauthentication_not_valid" }),
  u.INVALID_CODE_MESSAGE,
);
eq(
  "código por mensaje",
  u.changePasswordErrorMessage({ message: "Requested reauthentication nonce is invalid" }),
  u.INVALID_CODE_MESSAGE,
);
eq(
  "misma clave",
  u.changePasswordErrorMessage({ code: "same_password" }).includes("distinta"),
  true,
);

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
