#!/usr/bin/env node
/**
 * Revisa las reglas del logo del cliente (src/lib/clients/logo.ts): formato
 * por firma de bytes, tamaño máximo, hosts permitidos, cuándo se puede pisar
 * un logo y cuándo el cron lo refresca.
 * Uso: node scripts/check-client-logo.mjs  (o npm run check:client-logo)
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "client-logo-check-"));
const outFile = join(outDir, "logo.mjs");

await build({
  entryPoints: [join(root, "src/lib/clients/logo.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  logLevel: "error",
});

const l = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
const eq = (name, got, want) => {
  if (got !== want) failures.push(`${name}: esperaba ${want}, obtuvo ${got}`);
};

const bytes = (...head) => {
  const b = new Uint8Array(64);
  b.set(head);
  return b;
};
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"));
const GIF = bytes(...ascii("GIF89a"));
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

// Detección por firma
eq("jpeg", l.detectImageType(JPEG), "image/jpeg");
eq("png", l.detectImageType(PNG), "image/png");
eq("webp", l.detectImageType(WEBP), "image/webp");
eq("gif rechazado", l.detectImageType(GIF), null);
eq("svg rechazado", l.detectImageType(SVG), null);
eq("vacío", l.detectImageType(new Uint8Array(0)), null);

// Validación completa
eq("jpeg ok", l.validateLogoBytes(JPEG, "image/jpeg").ok, true);
eq("jpeg con image/jpg", l.validateLogoBytes(JPEG, "image/jpg").ok, true);
eq("sin tipo declarado", l.validateLogoBytes(PNG, null).ok, true);
eq("header con charset", l.validateLogoBytes(WEBP, "image/webp; charset=binary").ok, true);
eq(
  "tipo declarado no coincide",
  l.validateLogoBytes(PNG, "image/jpeg").error,
  l.LOGO_ERRORS.badType,
);
eq("gif", l.validateLogoBytes(GIF, "image/gif").error, l.LOGO_ERRORS.badType);
eq("vacío", l.validateLogoBytes(new Uint8Array(0)).error, l.LOGO_ERRORS.empty);
const big = new Uint8Array(l.LOGO_MAX_BYTES + 1);
big.set([0xff, 0xd8, 0xff]);
eq("más de 2 MB", l.validateLogoBytes(big, "image/jpeg").error, l.LOGO_ERRORS.tooBig);
const limit = new Uint8Array(l.LOGO_MAX_BYTES);
limit.set([0xff, 0xd8, 0xff]);
eq("justo 2 MB", l.validateLogoBytes(limit, "image/jpeg").ok, true);

// content-length
eq("cl ausente", l.exceedsDeclaredLength(null), false);
eq("cl chico", l.exceedsDeclaredLength("1000"), false);
eq("cl grande", l.exceedsDeclaredLength(String(l.LOGO_MAX_BYTES + 1)), true);
eq("cl basura", l.exceedsDeclaredLength("abc"), false);

// Hosts permitidos (SSRF)
eq("fbcdn", l.isAllowedPictureUrl("https://scontent.xx.fbcdn.net/v/t51/abc.jpg?x=1"), true);
eq("cdninstagram", l.isAllowedPictureUrl("https://scontent-scl1.cdninstagram.com/a.jpg"), true);
eq("http", l.isAllowedPictureUrl("http://scontent.xx.fbcdn.net/a.jpg"), false);
eq("host parecido", l.isAllowedPictureUrl("https://evilfbcdn.net/a.jpg"), false);
eq("sufijo engañoso", l.isAllowedPictureUrl("https://fbcdn.net.evil.com/a.jpg"), false);
eq("interno", l.isAllowedPictureUrl("https://169.254.169.254/latest"), false);
eq("no url", l.isAllowedPictureUrl("no es url"), false);

// Cuándo se puede pisar
eq("sin logo + auto", l.canUseInstagramLogo(null, "auto"), true);
eq("instagram + auto", l.canUseInstagramLogo("instagram", "auto"), true);
eq("manual + auto", l.canUseInstagramLogo("manual", "auto"), false);
eq("manual + botón", l.canUseInstagramLogo("manual", "button"), false);
eq("manual + volver a Instagram", l.canUseInstagramLogo("manual", "reset"), true);

// Refresco semanal
const now = new Date("2026-10-06T12:00:00Z");
const daysAgo = (d) => new Date(now.getTime() - d * 86_400_000).toISOString();
eq("nunca", l.isLogoStale(null, now), true);
eq("fecha inválida", l.isLogoStale("x", now), true);
eq("6 días", l.isLogoStale(daysAgo(6), now), false);
eq("7 días", l.isLogoStale(daysAgo(7), now), true);

// Ruta
eq("ruta jpg", l.logoPath("c1", "abc", "image/jpeg"), "logos/c1/abc.jpg");
eq("ruta webp", l.logoPath("c1", "abc", "image/webp"), "logos/c1/abc.webp");
eq("source", l.isLogoSource("manual") && !l.isLogoSource("otro"), true);

if (failures.length > 0) {
  console.error(`check:client-logo — ${failures.length} falla(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("check:client-logo — OK");
