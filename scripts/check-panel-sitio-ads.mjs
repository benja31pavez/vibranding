#!/usr/bin/env node
/**
 * Panel del cliente (/mi) · Sitio y publicidad: valida el parseo de los RPC
 * client_site_summary / client_meta_ads_summary / client_google_ads_summary
 * (lógica pura en src/components/client-panel/{siteModel,adsModel}.ts).
 * Uso: node scripts/check-panel-sitio-ads.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "panel-sitio-ads-"));
const entry = join(outDir, "entry.ts");
const outFile = join(outDir, "bundle.mjs");
writeFileSync(
  entry,
  [
    `export * as site from ${JSON.stringify(join(root, "src/components/client-panel/siteModel.ts"))};`,
    `export * as ads from ${JSON.stringify(join(root, "src/components/client-panel/adsModel.ts"))};`,
  ].join("\n"),
);

try {
  await build({
    entryPoints: [entry],
    outfile: outFile,
    bundle: true,
    format: "esm",
    platform: "node",
    alias: { "@": join(root, "src") },
    logLevel: "error",
  });
  const { site, ads } = await import(pathToFileURL(outFile).href);

  // ── Sitio ──
  assert.equal(site.parseSiteSummary(null), null);
  const s = site.parseSiteSummary({
    days: 30,
    multilink: { published: true, slug: "cafe-lunar", title: "Café", custom_domain: null },
    landing: { published: false, slug: "no-debe-verse" },
    multilink_metrics: { views: 12, clicks: "4", whatsapp_clicks: 2 },
    landing_metrics: { views: -3, clicks: "x", contacts: 1 },
  });
  assert.deepEqual(s.multilink, {
    published: true,
    slug: "cafe-lunar",
    title: "Café",
    url: "https://vibranding.pro/l/cafe-lunar",
  });
  assert.deepEqual(s.landing, { published: false }, "un borrador no expone su slug");
  assert.deepEqual(s.multilinkMetrics, { views: 12, clicks: 4, extra: 2 });
  assert.deepEqual(s.landingMetrics, { views: 0, clicks: 0, extra: 1 });
  const withDomain = site.parseSiteSummary({
    multilink: { published: true, slug: "x", custom_domain: "Links.Cafe.cl" },
    landing: { published: true, slug: "cafe" },
  });
  assert.equal(withDomain.multilink.url, "https://links.cafe.cl/l/x");
  assert.equal(withDomain.landing.url, "https://vibranding.pro/@cafe");
  assert.equal(
    site.parseSiteSummary({ multilink: { published: true, slug: "../../x" } }).multilink.published,
    false,
    "slug inválido no arma URL",
  );
  assert.equal(
    site.parseSiteSummary({
      multilink: { published: true, slug: "x", custom_domain: "evil.com/phish?" },
    }).multilink.url,
    "https://vibranding.pro/l/x",
    "dominio inválido cae al dominio de la plataforma",
  );
  assert.equal(site.displayUrl("https://vibranding.pro/l/x/"), "vibranding.pro/l/x");
  assert.equal(site.qrFileBase("Café Lunar", "landing"), "caf-lunar-landing");

  // ── Publicidad ──
  assert.equal(ads.parseAdsSummary(null, "meta"), null);
  assert.deepEqual(ads.parseAdsSummary({ connected: false, days: 7 }, "google"), {
    connected: false,
    days: 7,
  });
  const meta = ads.parseAdsSummary(
    {
      connected: true,
      days: 30,
      currency: "CLP",
      last_synced_at: "2026-10-07T10:00:00Z",
      billing_state: "rechazado",
      billing_reason: "no_funding",
      ad_account_id: "act_123",
      totals: {
        spend: 15000.4,
        impressions: 1500,
        reach: 1200,
        clicks: 70,
        results: 5,
        cost_per_result: 3000,
      },
      campaigns: [
        {
          name: " Campaña A ",
          status: "activa",
          spend: 15000,
          reach: 1200,
          clicks: 70,
          results: 5,
          cost_per_result: 3000,
        },
        { name: "", status: "hackeada", spend: "abc" },
        "basura",
      ],
    },
    "meta",
  );
  assert.equal(meta.connected, true);
  assert.equal(meta.billingState, "rechazado");
  assert.equal(meta.billingDetail, "Sin medio de pago");
  assert.equal(meta.totals.spend, 15000);
  assert.equal(meta.totals.reach, 1200);
  assert.equal(meta.campaigns.length, 2);
  assert.equal(meta.campaigns[0].name, "Campaña A");
  assert.equal(meta.campaigns[1].name, "Campaña sin nombre");
  assert.equal(meta.campaigns[1].status, "sin_dato");
  assert.equal(meta.campaigns[1].costPerResult, null);
  assert.ok(!JSON.stringify(meta).includes("act_123"), "no arrastra campos desconocidos");

  const google = ads.parseAdsSummary(
    {
      connected: true,
      billing_state: "verificado",
      billing_reason: "no_funding",
      totals: {
        spend: 3000,
        impressions: 100,
        reach: 99,
        clicks: 10,
        results: 0.5,
        cost_per_result: null,
      },
      campaigns: [],
    },
    "google",
  );
  assert.equal(google.totals.reach, null, "Google no tiene alcance");
  assert.equal(google.totals.results, 0.5);
  assert.equal(google.billingDetail, null);
  assert.equal(google.days, ads.DEFAULT_ADS_PERIOD);
  assert.equal(
    ads.parseAdsSummary({ connected: true, billing_state: "raro" }, "meta").billingState,
    "pendiente",
  );
  const many = ads.parseAdsSummary(
    { connected: true, campaigns: Array.from({ length: 40 }, (_, i) => ({ name: `c${i}` })) },
    "meta",
  );
  assert.equal(many.campaigns.length, 20);

  const now = new Date("2026-10-07T12:00:00Z");
  assert.equal(ads.syncedAgo(null, now), null);
  assert.equal(ads.syncedAgo("2026-10-07T11:30:00Z", now), "Actualizado hace menos de 1 h");
  assert.equal(ads.syncedAgo("2026-10-07T09:00:00Z", now), "Actualizado hace 3 h");
  assert.equal(ads.syncedAgo("2026-10-06T10:00:00Z", now), "Actualizado hace 1 día");
  assert.equal(ads.syncedAgo("2026-10-08T10:00:00Z", now), null);
  assert.equal(ads.formatCount(12345), "12.345");

  console.log("check-panel-sitio-ads: OK");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
