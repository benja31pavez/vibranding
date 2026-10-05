#!/usr/bin/env node
/**
 * Revisa la agregación pura de Estadísticas (src/lib/analytics/*.ts): bots,
 * deduplicación, visitantes únicos por día de Santiago, atribución de primer
 * contacto, embudo y paginación.
 * Uso: node scripts/check-analytics.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "analytics-check-"));
const entry = join(outDir, "entry.ts");
const outFile = join(outDir, "analytics.mjs");
const lib = join(root, "src/lib/analytics");
writeFileSync(
  entry,
  ["aggregate", "attribution", "bots", "time", "visitor"]
    .map((m) => `export * from ${JSON.stringify(join(lib, `${m}.ts`))};`)
    .join("\n"),
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

const a = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
const HEADLESS =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0 Safari/537.36";
const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const headers = (obj) => ({ get: (k) => obj[k.toLowerCase()] ?? null });

check("bots por user-agent", () => {
  for (const ua of [
    GOOGLEBOT,
    HEADLESS,
    "facebookexternalhit/1.1",
    "curl/8.4.0",
    "python-requests/2.31",
    "",
    null,
    "Lighthouse",
  ]) {
    assert.equal(a.isBotUserAgent(ua), true, `debería ser bot: ${ua}`);
  }
  for (const ua of [CHROME, IPHONE, IPAD, ANDROID_TABLET]) {
    assert.equal(a.isBotUserAgent(ua), false, `no es bot: ${ua}`);
  }
});

check("withoutBots conserva filas sin user_agent", () => {
  const rows = [{ id: 1, user_agent: GOOGLEBOT }, { id: 2, user_agent: CHROME }, { id: 3 }];
  assert.deepEqual(
    a.withoutBots(rows).map((r) => r.id),
    [2, 3],
  );
});

check("headless y prefetch por cabeceras", () => {
  assert.equal(a.isAutomatedRequest(headers({ "sec-ch-ua": '"HeadlessChrome";v="129"' })), true);
  assert.equal(a.isAutomatedRequest(headers({ "sec-purpose": "prefetch;prerender" })), true);
  assert.equal(a.isAutomatedRequest(headers({ purpose: "prefetch" })), true);
  assert.equal(a.isAutomatedRequest(headers({ "sec-ch-ua": '"Chromium";v="129"' })), false);
});

check("dispositivo", () => {
  assert.equal(a.deviceType(IPHONE), "mobile");
  assert.equal(a.deviceType(IPAD), "tablet");
  assert.equal(a.deviceType(ANDROID_TABLET), "tablet");
  assert.equal(a.deviceType(CHROME), "desktop");
});

check("primer contacto: UTM, gclid/fbclid, dominio y ruta sin query", () => {
  const t = a.firstTouchFrom({
    search: "?utm_source=Instagram&utm_medium=Story&utm_campaign=oct&gclid=abc&email=x@y.cl",
    referrer: "https://www.google.cl/search?q=agencia",
    ownHost: "vibranding.pro",
    pathname: "/diagnostico/",
  });
  assert.deepEqual(t, {
    utmSource: "instagram",
    utmMedium: "story",
    utmCampaign: "oct",
    referrerDomain: "google.cl",
    hasGclid: true,
    hasFbclid: false,
    landingPath: "/diagnostico",
  });
  const internal = a.firstTouchFrom({
    search: "?fbclid=1",
    referrer: "https://www.vibranding.pro/faq",
    ownHost: "vibranding.pro",
    pathname: "/",
  });
  assert.equal(internal.referrerDomain, null, "navegación interna no es fuente");
  assert.equal(internal.hasFbclid, true);
});

check("etiqueta de fuente", () => {
  assert.equal(a.sourceLabel({ has_gclid: true, utm_source: "x" }), "Google Ads");
  assert.equal(a.sourceLabel({ utm_source: "Instagram", utm_medium: "bio" }), "instagram / bio");
  assert.equal(a.sourceLabel({ has_fbclid: true }), "Meta (Facebook / Instagram)");
  assert.equal(a.sourceLabel({ referrer_domain: "google.cl" }), "Google (orgánico)");
  assert.equal(a.sourceLabel({ referrer: "https://l.instagram.com/?u=x" }), "Instagram");
  assert.equal(a.sourceLabel({ referrer: "https://vibranding.pro/faq" }), "Directo");
  assert.equal(a.sourceLabel({}), "Directo");
});

check("rutas públicas del sitio", () => {
  assert.equal(a.isPublicSitePath("/"), true);
  assert.equal(a.isPublicSitePath("/diagnostico?plan=contenido"), true);
  assert.equal(a.isPublicSitePath("/dashboard"), false);
  assert.equal(a.isPublicSitePath("/@cliente"), false);
});

check("días de Santiago (incluye cambio de horario)", () => {
  // 00:30 hora de Chile (UTC-3 en verano) = 03:30 UTC del mismo día.
  assert.equal(a.santiagoDayKey("2026-01-15T03:30:00Z"), "2026-01-15");
  assert.equal(a.santiagoDayKey("2026-01-15T02:30:00Z"), "2026-01-14");
  const range = a.santiagoDayRange(7, new Date("2026-04-08T15:00:00Z"));
  assert.equal(range.length, 7);
  assert.equal(range[6], "2026-04-08");
  assert.equal(new Set(range).size, 7, "sin días repetidos");
  const ninety = a.santiagoDayRange(90, new Date("2026-10-05T12:00:00Z"));
  assert.equal(ninety.length, 90);
  assert.equal(new Set(ninety).size, 90);
});

check("material del hash: incluye sal y día, nunca solo la IP", () => {
  const m = a.visitorHashMaterial({
    ip: "1.2.3.4",
    userAgent: "UA",
    dayKey: "2026-10-05",
    salt: "s",
  });
  assert.ok(m.includes("2026-10-05") && m.startsWith("s|"));
  assert.notEqual(m, "1.2.3.4");
});

const NOW = new Date("2026-10-05T18:00:00Z"); // 15:00 en Santiago
const ev = (over) => ({
  id: over.id,
  event_name: "page_view",
  created_at: "2026-10-05T14:00:00Z",
  user_agent: CHROME,
  ...over,
});

check("embudo: dedupe por visitante-día, bots fuera, fuentes y conversión", () => {
  const rows = [
    // Visitante A (Google Ads): 2 vistas el mismo día = 1 visita única; clic WhatsApp y diagnóstico.
    ev({ id: "1", visitor_hash: "a", session_id: "s1", has_gclid: true, device_type: "mobile" }),
    ev({
      id: "2",
      visitor_hash: "a",
      session_id: "s1",
      has_gclid: true,
      created_at: "2026-10-05T14:05:00Z",
    }),
    ev({
      id: "3",
      visitor_hash: "a",
      session_id: "s1",
      event_name: "whatsapp_click",
      has_gclid: true,
      created_at: "2026-10-05T14:06:00Z",
    }),
    ev({
      id: "4",
      visitor_hash: "a",
      session_id: "s1",
      event_name: "contact_submit",
      has_gclid: true,
      created_at: "2026-10-05T14:09:00Z",
    }),
    ev({
      id: "4b",
      visitor_hash: "a",
      session_id: "s1",
      event_name: "contact_submit",
      has_gclid: true,
      created_at: "2026-10-05T14:10:00Z",
    }),
    // Visitante A otro día = otra visita única.
    ev({ id: "5", visitor_hash: "a2", session_id: "s2", created_at: "2026-10-03T14:00:00Z" }),
    // Visitante B directo, clic a plan.
    ev({ id: "6", session_id: "s3", device_type: "desktop" }),
    ev({ id: "7", session_id: "s3", event_name: "contact_click", cta: "plan:crecimiento" }),
    // Bot: no cuenta.
    ev({ id: "8", user_agent: GOOGLEBOT }),
    // Fuera de rango (8 días atrás).
    ev({ id: "9", session_id: "s9", created_at: "2026-09-27T14:00:00Z" }),
    // Evento antiguo sin sesión.
    ev({ id: "10", referrer: "https://l.facebook.com/" }),
  ];
  const s = a.aggregateSiteStats(rows, {
    days: 7,
    now: NOW,
    prospectDates: ["2026-10-05T14:10:00Z", "2026-09-01T00:00:00Z"],
  });
  const f = Object.fromEntries(s.funnel.map((x) => [x.key, x]));
  assert.equal(f.visits.value, 4, "A hoy, A otro día, B, antiguo");
  assert.equal(f.cta.value, 2);
  assert.equal(f.submits.value, 1, "dos envíos de la misma sesión = 1");
  assert.equal(f.prospects.value, 1, "solo prospectos dentro del rango");
  assert.equal(f.cta.rateFromVisits, 50);
  assert.equal(f.submits.rateFromVisits, 25);
  assert.equal(s.sample.botsExcluded, 1);
  assert.equal(s.sample.legacyEvents, 1);
  assert.equal(s.sample.sessions, 3);
  assert.deepEqual(s.ctaBreakdown, { whatsapp: 1, diagnostico: 0, plan: 1 });
  const ads = s.sources.find((r) => r.source === "Google Ads");
  assert.deepEqual(ads, {
    source: "Google Ads",
    visits: 1,
    ctaVisitors: 1,
    submits: 1,
    conversion: 100,
  });
  assert.ok(s.sources.some((r) => r.source === "Facebook"));
  assert.equal(s.trend.length, 7);
  assert.equal(s.trend.at(-1).visits, 3);
  assert.equal(s.devices.mobile, 1);
  assert.equal(s.devices.desktop, 3);
});

check("sin visitas: tasas null (no 0% ni división por cero)", () => {
  const s = a.aggregateSiteStats([], { days: 30, now: NOW, prospectDates: [] });
  assert.ok(s.funnel.every((x) => x.value === 0 && x.rateFromVisits === null));
  assert.equal(s.trend.length, 30);
});

check("paginación", () => {
  const items = Array.from({ length: 13 }, (_, i) => i);
  assert.deepEqual(a.paginate(items, 0, 6), { items: [0, 1, 2, 3, 4, 5], page: 0, pages: 3 });
  assert.deepEqual(a.paginate(items, 9, 6), { items: [12], page: 2, pages: 3 });
  assert.deepEqual(a.paginate([], 0, 6), { items: [], page: 0, pages: 1 });
});

check("patrones de sesión y CTA", () => {
  assert.ok(a.SESSION_ID_PATTERN.test("3f2b6c1e-8d4a-4b8e-9c1f-2a3b4c5d6e7f"));
  assert.ok(!a.SESSION_ID_PATTERN.test("<script>"));
  assert.ok(a.CTA_ID_PATTERN.test("plan:crecimiento"));
  assert.ok(!a.CTA_ID_PATTERN.test("a b"));
});

if (failures.length) {
  console.error(`check-analytics: ${failures.length} fallo(s)`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("check-analytics: OK");
