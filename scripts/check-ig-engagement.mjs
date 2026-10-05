#!/usr/bin/env node
/**
 * Revisa el cálculo de engagement de Instagram (src/lib/instagram/engagement.ts).
 * Uso: node scripts/check-ig-engagement.mjs  (o npm run check:ig-engagement)
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "ig-engagement-check-"));
const outFile = join(outDir, "engagement.mjs");

await build({
  entryPoints: [join(root, "src/lib/instagram/engagement.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  logLevel: "error",
});

const e = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
const eq = (name, got, want) => {
  if (got !== want) failures.push(`${name}: esperaba ${want}, obtuvo ${got}`);
};

const now = new Date("2026-10-05T12:00:00Z");
const hoursAgo = (h) => new Date(now.getTime() - h * 3600_000).toISOString();
const post = (h, likes, comments) => ({
  timestamp: hoursAgo(h),
  like_count: likes,
  comments_count: comments,
});

// 14 posts, uno cada 2 días; el más nuevo tiene 2 h (se excluye).
const media = [post(2, 9999, 999)];
for (let i = 1; i <= 13; i++) media.push(post(i * 48, 100, 10));

const r = e.computeEngagement({ followers: 5000, media, now });
eq("ok", r.ok, true);
eq("muestra máx. 12", r.metrics.postsSampled, 12);
eq("promedio likes", r.metrics.avgLikes, 100);
eq("promedio comentarios", r.metrics.avgComments, 10);
eq("tasa 110/5000", r.metrics.engagementRate, 2.2);
eq("posts por semana (cada 2 días)", r.metrics.postsPerWeek, 3.5);
eq(
  "excluye < 24 h",
  e.selectSample(media, now).sample.some((m) => m.like_count === 9999),
  false,
);

const r2 = e.computeEngagement({ followers: 3000, media: [post(30, 50, 3), post(80, 41, 0)], now });
eq("2 decimales", r2.metrics.engagementRate, 1.57);
eq("muestra chica", r2.metrics.postsSampled, 2);

eq("sin seguidores", e.computeEngagement({ followers: 0, media, now }).ok, false);
eq("seguidores null", e.computeEngagement({ followers: null, media, now }).ok, false);
const fresh = e.computeEngagement({ followers: 100, media: [post(3, 5, 1)], now });
eq("solo posts nuevos", fresh.error, e.ENGAGEMENT_ERRORS.noPosts);
const hidden = e.computeEngagement({
  followers: 100,
  media: [{ timestamp: hoursAgo(50), like_count: null, comments_count: 2 }],
  now,
});
eq("likes ocultos no se inventan", hidden.error, e.ENGAGEMENT_ERRORS.hiddenCounts);
const noTs = e.computeEngagement({
  followers: 100,
  media: [{ timestamp: null, like_count: 5, comments_count: 1 }],
  now,
});
eq("sin fecha se excluye", noTs.ok, false);
eq("un post: sin ritmo semanal", e.postsPerWeek([post(30, 1, 1)]), null);

// Benchmarks por tramo de seguidores
eq("<10k alto", e.benchmarkLevel(3.5, 5000), "alto");
eq("<10k medio", e.benchmarkLevel(1.2, 5000), "medio");
eq("<10k bajo", e.benchmarkLevel(0.9, 5000), "bajo");
eq("10k-100k alto", e.benchmarkLevel(2.1, 50_000), "alto");
eq("10k-100k medio", e.benchmarkLevel(0.8, 50_000), "medio");
eq("10k-100k bajo", e.benchmarkLevel(0.5, 50_000), "bajo");
eq(">100k alto", e.benchmarkLevel(1.4, 250_000), "alto");
eq(">100k bajo", e.benchmarkLevel(0.2, 250_000), "bajo");
eq("borde 10k es tramo medio", e.benchmarkTier(10_000).high, 2);

// Handles
eq("handle @", e.normalizeIgHandle("@Proyecta.Exteriores"), "proyecta.exteriores");
eq("handle url", e.normalizeIgHandle("https://www.instagram.com/marca_cl/?hl=es"), "marca_cl");
eq("handle inválido", e.normalizeIgHandle("mi marca"), null);
eq("handle vacío", e.normalizeIgHandle(""), null);
eq("handle inyección", e.normalizeIgHandle("x){id}"), null);

// Caché 12 h
eq("fresco", e.isFresh(hoursAgo(11), now), true);
eq("vencido", e.isFresh(hoursAgo(13), now), false);
eq("sin fecha no es fresco", e.isFresh(null, now), false);

// Errores de Business Discovery
eq("subcode 2207013", e.isDiscoveryNotMeasurable(110, 2207013), true);
eq("otro error", e.isDiscoveryNotMeasurable(4, null), false);

// No muta la entrada
const before = media.map((m) => m.timestamp).join();
e.computeEngagement({ followers: 5000, media, now });
eq("no muta la entrada", media.map((m) => m.timestamp).join(), before);

if (failures.length > 0) {
  console.error(`check-ig-engagement: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-ig-engagement: OK");
