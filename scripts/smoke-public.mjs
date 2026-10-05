#!/usr/bin/env node
// Smoke test de páginas públicas. Sin dependencias ni credenciales.
//   node scripts/smoke-public.mjs                  -> levanta `wrangler dev` sobre .output (build previo)
//   BASE_URL=http://localhost:8787 node scripts/smoke-public.mjs  -> usa un servidor ya levantado
// Nunca apunta a producción: se rechaza BASE_URL con vibranding.pro.
import { spawn } from "node:child_process";

const PORT = process.env.SMOKE_PORT || "8799";
const INSPECTOR_PORT = process.env.SMOKE_INSPECTOR_PORT || "9399";
const READY_TIMEOUT_MS = 90_000;
const REQUEST_TIMEOUT_MS = 30_000;
const SERVICE_PAGES = [
  "/pagina-web-para-pymes",
  "/agencia-marketing-digital-santiago",
  "/publicidad-meta-ads",
  "/google-ads-pymes",
  "/chatbot-whatsapp",
];
const CONTENT_PAGES = ["/", "/diagnostico", "/faq", "/terms", "/privacy", ...SERVICE_PAGES];

const FORBIDDEN_PROMISES = [
  /garant[ií]a\s+de\s+devoluci[oó]n/i,
  /reembolso\s+garantizado/i,
  /devoluci[oó]n\s+garantizada/i,
  /dinero\s+de\s+vuelta/i,
  /money[- ]back/i,
];

const failures = [];
const check = (ok, msg) => {
  if (!ok) failures.push(msg);
  console.log(`${ok ? "ok  " : "FAIL"} ${msg}`);
};

const explicitBase = process.env.BASE_URL;
if (explicitBase && /vibranding\.pro/i.test(explicitBase)) {
  console.error("Rechazado: el smoke test no debe correr contra producción.");
  process.exit(2);
}
const base = (explicitBase || `http://localhost:${PORT}`).replace(/\/$/, "");

let server = null;
let serverLog = "";
function stopServer() {
  if (!server || server.killed) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}
process.on("exit", stopServer);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(130));

function startServer() {
  server = spawn(
    "npx",
    ["wrangler", "dev", "-c", ".output/server/wrangler.json", "--local", "--port", PORT, "--inspector-port", INSPECTOR_PORT],
    { stdio: ["ignore", "pipe", "pipe"], detached: true, env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" } },
  );
  const collect = (d) => (serverLog = (serverLog + d).slice(-20_000));
  server.stdout.on("data", collect);
  server.stderr.on("data", collect);
  server.on("exit", (code) => collect(`\n[wrangler exit ${code}]\n`));
}

async function get(path, init = {}) {
  const res = await fetch(base + path, {
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    ...init,
  });
  return { res, body: await res.text() };
}

async function waitReady() {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server && server.exitCode !== null) throw new Error(`wrangler terminó antes de estar listo:\n${serverLog}`);
    try {
      const { res } = await get("/robots.txt");
      if (res.status === 200) return;
    } catch {
      /* aún no listo */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout esperando ${base}:\n${serverLog}`);
}

const countMatches = (html, re) => (html.match(re) || []).length;
const titleOf = (html) => (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
const hasNoindex = (html, res) =>
  /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html) ||
  /noindex/i.test(res.headers.get("x-robots-tag") ?? "");

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

// Precios: cualquier monto debe ir con "$" y sin "USD".
function checkPrices(path, text) {
  check(!/\bUSD\b|US\$/.test(text), `${path}: sin "USD"`);
  const bare = text.match(/(?<![$\d.,])\b\d{1,3}(?:\.\d{3})+\s*(?:CLP|pesos)\b/gi);
  check(!bare, `${path}: precios con "$" (sin montos sueltos ${bare ? JSON.stringify(bare.slice(0, 3)) : ""})`);
}

async function checkContentPages() {
  const titles = new Map();
  for (const path of CONTENT_PAGES) {
    const { res, body } = await get(path);
    check(res.status === 200, `${path}: 200 (got ${res.status})`);
    check(countMatches(body, /<h1[\s>]/gi) === 1, `${path}: exactamente un <h1> (got ${countMatches(body, /<h1[\s>]/gi)})`);
    const title = titleOf(body);
    check(title.length > 0, `${path}: <title> no vacío`);
    check(!titles.has(title), `${path}: <title> único${titles.has(title) ? ` (repetido con ${titles.get(title)})` : ""}`);
    titles.set(title, path);
    check(/<link[^>]+rel="canonical"/i.test(body) || /<link[^>]+href="[^"]*"[^>]+rel="canonical"/i.test(body), `${path}: canonical presente`);
    const text = visibleText(body);
    const promise = FORBIDDEN_PROMISES.find((re) => re.test(text));
    check(!promise, `${path}: sin promesas de devolución${promise ? ` (${promise})` : ""}`);
    checkPrices(path, text);
  }
}

async function checkSeoEndpoints() {
  const sitemap = await get("/sitemap.xml");
  check(sitemap.res.status === 200, `/sitemap.xml: 200 (got ${sitemap.res.status})`);
  for (const path of SERVICE_PAGES) {
    check(sitemap.body.includes(`${path}</loc>`), `/sitemap.xml contiene ${path}`);
  }

  const robots = await get("/robots.txt");
  check(robots.res.status === 200, `/robots.txt: 200`);
  check(/^Disallow:\s*\/dashboard\s*$/im.test(robots.body), `/robots.txt: Disallow /dashboard`);

  const nf = await get(`/ruta-inexistente-${Date.now().toString(36)}`);
  check(nf.res.status === 404, `ruta inexistente: 404 (got ${nf.res.status})`);
  check(hasNoindex(nf.body, nf.res), `ruta inexistente: noindex`);

  const old = await get("/terminos");
  check(old.res.status === 301, `/terminos: 301 (got ${old.res.status})`);
  check(new URL(old.res.headers.get("location") ?? "", base).pathname === "/terms", `/terminos -> /terms`);

  const p = await get("/p/invalid");
  check(hasNoindex(p.body, p.res), `/p/invalid: noindex (status ${p.res.status})`);
  check(p.res.headers.get("referrer-policy") === "no-referrer", `/p/invalid: Referrer-Policy no-referrer`);
}

// Cabeceras de seguridad globales (src/lib/security/headers.ts).
async function checkSecurityHeaders() {
  for (const path of ["/", "/terms", "/robots.txt", "/sitemap.xml"]) {
    const { res } = await get(path);
    const h = (name) => res.headers.get(name) ?? "";
    if (path !== "/robots.txt") {
      // robots.txt puede servirse como asset estático (sin pasar por el Worker).
      check(h("x-content-type-options") === "nosniff", `${path}: X-Content-Type-Options nosniff`);
      check(h("x-frame-options") === "DENY", `${path}: X-Frame-Options DENY (got "${h("x-frame-options")}")`);
      check(/frame-ancestors 'none'/.test(h("content-security-policy")), `${path}: CSP frame-ancestors 'none'`);
      check(h("referrer-policy") === "strict-origin-when-cross-origin", `${path}: Referrer-Policy strict-origin-when-cross-origin`);
    }
  }
}

let exitCode = 0;
try {
  if (!explicitBase) {
    // Evita validar por error un servidor viejo que ya ocupe el puerto.
    const busy = await get("/robots.txt").then(() => true, () => false);
    if (busy) throw new Error(`El puerto ${PORT} ya está en uso; usa SMOKE_PORT o BASE_URL.`);
    startServer();
  }
  await waitReady();
  console.log(`Servidor listo en ${base}`);
  await checkContentPages();
  await checkSeoEndpoints();
  await checkSecurityHeaders();
  if (failures.length) {
    console.error(`\n${failures.length} chequeo(s) fallaron:\n - ${failures.join("\n - ")}`);
    exitCode = 1;
  } else {
    console.log("\nSmoke público OK");
  }
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  stopServer();
}
process.exit(exitCode);
