#!/usr/bin/env node
/**
 * Revisa el estado de las secciones del editor de sitio y las URLs públicas
 * (src/lib/site/siteStatus.ts): nunca deben usar el dominio de vista previa.
 * Uso: node scripts/check-site-editor.mjs  (o npm run check:site-editor)
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "site-editor-check-"));
const outFile = join(outDir, "siteStatus.mjs");

await build({
  entryPoints: [join(root, "src/lib/site/siteStatus.ts")],
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

const base = {
  hero_title: "Paisajismo Verde",
  hero_subtitle: "Jardines a medida",
  hero_image_url: "https://example.com/a.jpg",
  services: [{ title: "Mantención", description: "Semanal" }],
  gallery: [],
  whatsapp_enabled: true,
  whatsapp_number: "+56912345678",
  testimonials_enabled: false,
  testimonials: [],
  location_enabled: true,
  location: { comuna: "Providencia" },
  faq_enabled: true,
  faq: [{ question: "", answer: "" }],
  contact_enabled: true,
  hidden_sections: ["galeria"],
};

check("portada completa", () => assert.equal(s.heroStatus(base), "complete"));
check("portada sin foto", () =>
  assert.equal(s.heroStatus({ ...base, hero_image_url: null }), "missing"),
);
check("portada con error", () => assert.equal(s.heroStatus(base, true), "error"));
check("servicios completos", () =>
  assert.equal(s.landingSectionStatus(base, "servicios"), "complete"),
);
check("galería oculta", () => assert.equal(s.landingSectionStatus(base, "galeria"), "hidden"));
check("testimonios desactivados", () =>
  assert.equal(s.landingSectionStatus(base, "testimonios"), "hidden"),
);
check("faq vacía = falta contenido", () =>
  assert.equal(s.landingSectionStatus(base, "faq"), "missing"),
);
check("whatsapp sin número", () =>
  assert.equal(s.landingSectionStatus({ ...base, whatsapp_number: " " }, "whatsapp"), "missing"),
);
check("oculta gana sobre error", () =>
  assert.equal(s.landingSectionStatus(base, "galeria", true), "hidden"),
);
check("ubicación con comuna", () =>
  assert.equal(s.landingSectionStatus(base, "ubicacion"), "complete"),
);
check("multienlace sin enlaces visibles", () =>
  assert.equal(s.multilinkLinksStatus([{ is_active: false }]), "missing"),
);
check("multienlace con enlace visible", () =>
  assert.equal(s.multilinkLinksStatus([{ is_active: true }]), "complete"),
);

check("URL landing en producción", () =>
  assert.equal(s.landingPublicUrl("campuyjoaco"), "https://vibranding.pro/@campuyjoaco"),
);
check("URL multienlace en producción", () =>
  assert.equal(s.multilinkPublicUrlFor({ slug: "campuy" }), "https://vibranding.pro/l/campuy"),
);
check("URL multienlace con dominio propio verificado", () =>
  assert.equal(
    s.multilinkPublicUrlFor({
      slug: "campuy",
      custom_domain: "links.campuy.cl",
      custom_domain_verified: true,
    }),
    "https://links.campuy.cl/l/campuy",
  ),
);
check("dominio propio sin verificar usa producción", () =>
  assert.equal(
    s.multilinkPublicUrlFor({
      slug: "campuy",
      custom_domain: "x.cl",
      custom_domain_verified: false,
    }),
    "https://vibranding.pro/l/campuy",
  ),
);
check("displayUrl quita protocolo", () =>
  assert.equal(s.displayUrl("https://vibranding.pro/@a"), "vibranding.pro/@a"),
);

if (failures.length) {
  console.error(`check-site-editor: ${failures.length} fallas\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("check-site-editor: OK");
