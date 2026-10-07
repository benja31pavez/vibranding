#!/usr/bin/env node
/**
 * Aislamiento entre clientes y agencia (Fase 0 de plan-acceso-clientes.md).
 *
 * 1) Estático (siempre, también en CI sin base de datos): recorre
 *    supabase/migrations en orden y reconstruye los permisos EXECUTE de cada
 *    función. Falla si una función SECURITY DEFINER que toca el vault queda
 *    ejecutable por PUBLIC/anon/authenticated (salvo la lista permitida).
 *    Modela los privilegios por defecto de Supabase: una función nueva nace
 *    con EXECUTE para PUBLIC, anon, authenticated y service_role; un
 *    CREATE OR REPLACE conserva los permisos que ya tenía.
 *    Además revisa que no vuelvan patrones ya corregidos (review links sin
 *    cruzar client_id, escrituras con owns_client, listado público del bucket).
 *    Panel del cliente (/mi, Fase 1): sus archivos no usan clientId ni
 *    parámetros de URL, solo importan módulos de una lista permitida, solo
 *    leen client_self/client_users, no enlazan a rutas de agencia, y todas sus
 *    rutas cuelgan del layout /mi con guard. Fase 2: solo llaman los RPC
 *    client_* de PANEL_ALLOWED_RPCS, y esos RPC fijan el cliente con
 *    user_client_id(), no reciben un id de cliente ni son ejecutables por anon.
 *
 * 2) Base de datos (solo si hay DATABASE_URL y psql): ejecuta
 *    supabase/tests/aislamiento.sql (BEGIN … ROLLBACK). SOLO STAGING: se
 *    niega a correr contra el proyecto de producción.
 *
 * Uso: node scripts/check-aislamiento.mjs
 *      DATABASE_URL=postgres://…staging… node scripts/check-aislamiento.mjs
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const migrationsDir = join(root, "supabase/migrations");
const PROD_PROJECT_REF = "nigdjcocbwbphzzxayqg";

/** Funciones del vault que SÍ pueden ejecutar usuarios autenticados (validan rol por dentro). */
const AUTHENTICATED_ALLOWED = new Set([
  "public.org_meta_set_secret",
  "public.org_meta_token_status",
]);
/**
 * RPC que el panel puede llamar directo (Fase 2): SECURITY DEFINER que fijan el
 * cliente con user_client_id(), sin parámetro de cliente y sin EXECUTE para anon
 * (se verifica abajo contra las migraciones).
 */
export const PANEL_ALLOWED_RPCS = new Set([
  "client_leads_page",
  "client_whatsapp_status",
  "client_whatsapp_conversations",
  "client_whatsapp_messages",
  "client_instagram_overview",
]);
const EXPOSED_ROLES = ["public", "anon", "authenticated"];
const DEFAULT_GRANTEES = ["public", "anon", "authenticated", "service_role"];

/* ───────────────────────── Parser de migraciones ───────────────────────── */

function stripComments(sql) {
  // Suficiente para nuestras migraciones: quita comentarios de línea y de bloque.
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

/** "esquema.nombre" en minúsculas (esquema public por defecto). */
function qualify(raw) {
  const parts = raw.trim().replace(/"/g, "").toLowerCase().split(".");
  return parts.length > 1 ? `${parts[0]}.${parts[1]}` : `public.${parts[0]}`;
}

/** Funciones ("esquema.nombre") de una lista "public.a(uuid), b(text)". */
function functionNames(list) {
  const names = [];
  let depth = 0;
  let token = "";
  for (const ch of list) {
    if (ch === "(") {
      if (depth === 0) {
        if (token.trim()) names.push(qualify(token));
        token = "";
      }
      depth++;
    } else if (ch === ")") depth--;
    else if (depth === 0) token = ch === "," ? "" : token + ch;
  }
  return names;
}

function roleList(list) {
  return list
    .split(",")
    .map((r) => r.trim().replace(/"/g, "").toLowerCase())
    .filter(Boolean);
}

/**
 * Aplica una migración al estado { functions: Map<name, {secdef, vault, grants:Set}> }.
 * Procesa en orden de aparición: CREATE FUNCTION, DROP FUNCTION, GRANT, REVOKE.
 */
export function applyMigration(state, rawSql) {
  const sql = stripComments(rawSql);
  const events = [];

  const createRe = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w."]+)\s*\(/gi;
  for (const m of sql.matchAll(createRe)) {
    const name = qualify(m[1]);
    const rest = sql.slice(m.index);
    const tag = /\bAS\s+(\$[\w]*\$)/i.exec(rest);
    if (!tag) continue;
    const bodyStart = tag.index + tag[0].length;
    const bodyEnd = rest.indexOf(tag[1], bodyStart);
    const header = rest.slice(0, tag.index);
    const body = rest.slice(bodyStart, bodyEnd);
    const trailerEnd = rest.indexOf(";", bodyEnd + tag[1].length);
    const trailer = rest.slice(bodyEnd + tag[1].length, trailerEnd);
    events.push({
      at: m.index,
      kind: "create",
      name,
      secdef: /SECURITY\s+DEFINER/i.test(header + trailer),
      vault: /\bvault\./i.test(body),
    });
  }
  for (const m of sql.matchAll(/DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?([^;]+);/gi)) {
    for (const name of functionNames(m[1])) events.push({ at: m.index, kind: "drop", name });
  }
  const privRe =
    /\b(GRANT|REVOKE)\s+(?:ALL(?:\s+PRIVILEGES)?|EXECUTE)\s+ON\s+(FUNCTION|ALL\s+FUNCTIONS\s+IN\s+SCHEMA)\s+([\s\S]+?)\s+(TO|FROM)\s+([^;]+);/gi;
  for (const m of sql.matchAll(privRe)) {
    const all = /^ALL/i.test(m[2]);
    events.push({
      at: m.index,
      kind: m[1].toUpperCase() === "GRANT" ? "grant" : "revoke",
      names: all ? null : functionNames(m[3]),
      schema: all ? m[3].trim().replace(/"/g, "").toLowerCase() : null,
      roles: roleList(m[5].replace(/\bGRANTED\s+BY\b[\s\S]*$/i, "")),
    });
  }

  events.sort((a, b) => a.at - b.at);
  for (const e of events) {
    if (e.kind === "create") {
      const prev = state.functions.get(e.name);
      state.functions.set(e.name, {
        secdef: e.secdef,
        vault: e.vault,
        grants: prev ? prev.grants : new Set(DEFAULT_GRANTEES),
      });
    } else if (e.kind === "drop") {
      state.functions.delete(e.name);
    } else {
      const targets =
        e.names ?? [...state.functions.keys()].filter((k) => k.startsWith(`${e.schema}.`));
      for (const name of targets) {
        const fn = state.functions.get(name);
        if (!fn) continue;
        for (const role of e.roles) {
          if (e.kind === "grant") fn.grants.add(role);
          else fn.grants.delete(role);
        }
      }
    }
  }
  return state;
}

export function vaultExposures(state) {
  const problems = [];
  for (const [name, fn] of state.functions) {
    if (!fn.secdef || !fn.vault) continue;
    const exposed = EXPOSED_ROLES.filter(
      (r) => fn.grants.has(r) && !(r === "authenticated" && AUTHENTICATED_ALLOWED.has(name)),
    );
    if (exposed.length > 0) problems.push(`${name}: EXECUTE para ${exposed.join(", ")}`);
  }
  return problems;
}

/* ───────────────────────── Autotest del parser ───────────────────────── */

{
  // H1 tal como ocurrió: REVOKE solo de PUBLIC no basta en Supabase.
  const s = applyMigration(
    { functions: new Map() },
    `CREATE OR REPLACE FUNCTION public.x_get_secret(_id uuid) RETURNS text
     LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$ SELECT decrypted_secret FROM vault.decrypted_secrets $$;
     REVOKE ALL ON FUNCTION public.x_get_secret(uuid) FROM PUBLIC;
     GRANT EXECUTE ON FUNCTION public.x_get_secret(uuid) TO service_role;`,
  );
  assert.deepEqual(vaultExposures(s), ["public.x_get_secret: EXECUTE para anon, authenticated"]);
  // Un REVOKE sobre otro esquema no la cubre.
  applyMigration(
    s,
    `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;`,
  );
  assert.equal(vaultExposures(s).length, 1);
  applyMigration(
    s,
    `REVOKE EXECUTE ON FUNCTION public.x_get_secret(uuid) FROM anon, authenticated;`,
  );
  assert.deepEqual(vaultExposures(s), []);
  // Un CREATE OR REPLACE posterior conserva los permisos (no los resetea).
  applyMigration(
    s,
    `CREATE OR REPLACE FUNCTION public.x_get_secret(_id uuid) RETURNS text LANGUAGE sql
     SECURITY DEFINER AS $f$ SELECT 1 FROM vault.secrets $f$;`,
  );
  assert.deepEqual(vaultExposures(s), []);
  // Funciones invoker o que no tocan vault no cuentan.
  applyMigration(
    s,
    `CREATE FUNCTION public.y() RETURNS int LANGUAGE sql AS $$ SELECT 1 FROM vault.secrets $$;`,
  );
  assert.deepEqual(vaultExposures(s), []);
}

/* ───────────────────────── 1) Chequeo estático ───────────────────────── */

const failures = [];
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const state = { functions: new Map() };
const sqlByFile = new Map();
for (const f of files) {
  const sql = readFileSync(join(migrationsDir, f), "utf8");
  sqlByFile.set(f, stripComments(sql));
  applyMigration(state, sql);
}

const vaultFns = [...state.functions].filter(([, fn]) => fn.secdef && fn.vault);
if (vaultFns.length === 0)
  failures.push("no se encontró ninguna función SECURITY DEFINER con vault");
for (const p of vaultExposures(state)) failures.push(`vault expuesto → ${p}`);

/** Última definición (texto completo) de una función en las migraciones. */
function lastFunctionSql(name) {
  let last = null;
  for (const sql of sqlByFile.values()) {
    const re = new RegExp(
      `CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${name}\\s*\\([\\s\\S]*?\\$\\$;`,
      "gi",
    );
    for (const m of sql.matchAll(re)) last = m[0];
  }
  return last;
}

// H4: los RPC de review links cruzan el entregable con el client_id del link.
for (const fn of ["review_link_get", "review_link_comment"]) {
  const def = lastFunctionSql(fn);
  if (!def) failures.push(`${fn}: no se encontró en las migraciones`);
  else if (!/client_id\s*=\s*l\.client_id/i.test(def)) {
    failures.push(`${fn}: la última versión no cruza deliverables con l.client_id`);
  }
}

// H11: ensure_org rechaza usuarios cliente.
{
  const def = lastFunctionSql("ensure_org");
  if (!def || !/client_users/i.test(def)) {
    failures.push("ensure_org: la última versión no rechaza a usuarios cliente");
  }
}

// H11: un usuario cliente no puede insertar orgs directo por la API.
{
  let last = null;
  for (const sql of sqlByFile.values()) {
    for (const m of sql.matchAll(
      /CREATE\s+POLICY\s+"orgs insert"\s+ON\s+public\.orgs([\s\S]*?);/gi,
    )) {
      last = m[1];
    }
  }
  if (!last || !/user_client_id\(\)\s+IS\s+NULL/i.test(last)) {
    failures.push('orgs: "orgs insert" no excluye a usuarios cliente');
  }
}

// H10: desde la migración de editores, ninguna policy de escritura nueva usa owns_client.
const EDITORS_MIGRATION = "20261012002320";
for (const [f, sql] of sqlByFile) {
  if (f.slice(0, 14) < EDITORS_MIGRATION) continue;
  const policyRe = /(CREATE|ALTER)\s+POLICY\s+("[^"]+"|\w+)\s+ON\s+([\w.]+)([\s\S]*?);/gi;
  for (const m of sql.matchAll(policyRe)) {
    const body = m[4];
    const isRead = /\bFOR\s+SELECT\b/i.test(body);
    if (!isRead && /owns_client\s*\(/i.test(body)) {
      failures.push(
        `${f}: policy ${m[2]} en ${m[3]} escribe con owns_client (usa can_edit_client)`,
      );
    }
  }
}

// H7: la última mención de "client-media public read" es un DROP.
{
  let lastIsDrop = null;
  for (const sql of sqlByFile.values()) {
    for (const m of sql.matchAll(
      /(CREATE|DROP)\s+POLICY\s+(?:IF\s+EXISTS\s+)?"client-media public read"/gi,
    )) {
      lastIsDrop = m[1].toUpperCase() === "DROP";
    }
  }
  if (lastIsDrop === false) failures.push('storage: "client-media public read" sigue activa');
}

// H5: la policy SELECT de clients ya no incluye user_client_id().
{
  let last = null;
  for (const sql of sqlByFile.values()) {
    for (const m of sql.matchAll(
      /CREATE\s+POLICY\s+"clients select"\s+ON\s+public\.clients([\s\S]*?);/gi,
    )) {
      last = m[1];
    }
  }
  if (last && /user_client_id/i.test(last)) {
    failures.push(
      'clients: "clients select" sigue dejando leer la fila completa al usuario cliente',
    );
  }
}

// Panel del cliente: el usuario nunca puede editar su propia fila de client_users
// (panel_enabled, client_id). Ninguna policy UPDATE/ALL vigente usa auth.uid().
{
  const live = new Map();
  for (const sql of sqlByFile.values()) {
    const re =
      /(CREATE|DROP)\s+POLICY\s+(?:IF\s+EXISTS\s+)?("[^"]+"|\w+)\s+ON\s+(?:public\.)?client_users\b([^;]*);/gi;
    for (const m of sql.matchAll(re)) {
      if (m[1].toUpperCase() === "DROP") live.delete(m[2]);
      else live.set(m[2], m[3]);
    }
  }
  for (const [name, body] of live) {
    const cmd =
      /\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i.exec(body)?.[1]?.toUpperCase() ?? "ALL";
    if ((cmd === "UPDATE" || cmd === "ALL") && /auth\.uid\(\)/i.test(body)) {
      failures.push(
        `client_users: la policy ${name} (${cmd}) deja al propio usuario editar su fila`,
      );
    }
  }
  const trigger = sqlByFile.get("20261012002800_client_users_panel_enabled.sql") ?? "";
  if (!/CREATE\s+TRIGGER\s+t_client_users_guard_update/i.test(trigger)) {
    failures.push("client_users: falta el trigger t_client_users_guard_update");
  }
}

// Panel del cliente (Fase 2): cada RPC permitido al panel fija el cliente con
// user_client_id(), es SECURITY DEFINER con search_path vacío, no recibe un id
// de cliente y no es ejecutable por anon/PUBLIC.
for (const name of PANEL_ALLOWED_RPCS) {
  const def = lastFunctionSql(name);
  const fn = state.functions.get(`public.${name}`);
  if (!def || !fn) {
    failures.push(`${name}: no se encontró en las migraciones`);
    continue;
  }
  if (!/SECURITY\s+DEFINER/i.test(def) || !/SET\s+search_path\s*=\s*''/i.test(def)) {
    failures.push(`${name}: debe ser SECURITY DEFINER con search_path = ''`);
  }
  if (!/public\.user_client_id\(\)/i.test(def)) {
    failures.push(`${name}: no fija el cliente con user_client_id()`);
  }
  const params = /FUNCTION\s+(?:public\.)?\w+\s*\(([^)]*)\)/i.exec(def)?.[1] ?? "";
  if (/client/i.test(params)) failures.push(`${name}: recibe un parámetro de cliente`);
  if (
    /ai_system_prompt|ai_business_context|_secret_id|lead_meta\.notes|m\.notes|approval_note\b/i.test(
      def,
    )
  ) {
    failures.push(`${name}: lee columnas internas (prompt, secretos o notas)`);
  }
  const exposed = ["public", "anon"].filter((r) => fn.grants.has(r));
  if (exposed.length > 0) failures.push(`${name}: EXECUTE para ${exposed.join(", ")}`);
}

/* ───────────── Panel del cliente (/mi, Fase 1): estático ───────────── */

/**
 * El panel del cliente (src/routes/mi*, src/components/client-panel) nunca
 * toma el cliente de la URL, solo importa piezas seguras para el cliente
 * (lista permitida, falla cerrado) y solo lee client_self / client_users.
 */
const PANEL_ALLOWED_IMPORTS = [
  /^react$/,
  /^@tanstack\/react-(router|query)$/,
  /^lucide-react$/,
  /^sonner$/,
  /^@\/components\/ui\/[\w-]+$/,
  /^@\/components\/app$/,
  /^@\/components\/icons\/[\w-]+$/,
  /^@\/components\/client-panel\/[\w-]+$/,
  /^@\/components\/portal\/(CalendarSection|BillingSection|usePortal)$/,
  /^@\/components\/profile\/SecuritySection$/,
  // Solo presentación (recibe datos por props; sus imports de InstagramEditor son de tipos).
  /^@\/components\/IphonePreview$/,
  /^@\/hooks\/use-auth$/,
  /^@\/integrations\/supabase\/client$/,
  /^@\/lib\/auth\/(clientPanel|userKind)$/,
  /^@\/lib\/(portal\/model|billing\/dates|utils|site\/robots)$/,
  /^\.\/[\w-]+$/,
];
/** Prohibidos explícitos (leen tablas internas o son de la agencia): mensaje claro. */
const PANEL_FORBIDDEN_IMPORTS = [
  /^@\/contexts\/ActiveClientContext/,
  /^@\/components\/(shell|clients|dashboard|plan|setup|analytics|ficha)\b/,
  /^@\/hooks\/use-(client-capabilities|review-alerts|unmarked-outcomes)/,
  /^@\/lib\/(dashboard|clients|meta|whatsapp|google-ads)\b/,
  /fichaQueries|agencyQueries|adsBillingSources/,
  /^@\/integrations\/supabase\/client\.server/,
];
const PANEL_ALLOWED_TABLES = new Set(["client_self", "client_users"]);
const AGENCY_PATHS =
  /["'`]\/(clients|dashboard|settings|setup|admin|pipeline|billing|reports|approvals|profile)\b/;

function stripJsComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** Problemas de un archivo del panel (ruta relativa + código fuente). */
export function panelFileProblems(file, rawSrc) {
  const src = stripJsComments(rawSrc);
  const problems = [];
  const imports = [
    ...src.matchAll(/\bfrom\s+["']([^"']+)["']/g),
    ...src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
  ].map((m) => m[1]);
  for (const spec of imports) {
    if (PANEL_FORBIDDEN_IMPORTS.some((re) => re.test(spec))) {
      problems.push(`${file}: importa ${spec} (prohibido en el panel del cliente)`);
    } else if (!PANEL_ALLOWED_IMPORTS.some((re) => re.test(spec))) {
      problems.push(`${file}: importa ${spec} (no está en la lista permitida del panel)`);
    }
  }
  if (/\$?clientId\b/.test(src)) {
    problems.push(`${file}: usa clientId (el cliente sale de la sesión, nunca de la URL)`);
  }
  const isSectionParam = file.endsWith("routes/mi/$seccion.tsx");
  if (/\buse(Params|Search)\b|\bvalidateSearch\b/.test(src) && !isSectionParam) {
    problems.push(`${file}: lee parámetros de la URL`);
  }
  if (isSectionParam) {
    for (const m of src.matchAll(/\bparams\.(\w+)|\{\s*(\w+)\s*\}\s*=\s*Route\.useParams/g)) {
      const name = m[1] ?? m[2];
      if (name !== "seccion") problems.push(`${file}: lee el parámetro ${name}`);
    }
  }
  for (const m of src.matchAll(/\.from\(\s*["'`]([\w.]+)["'`]\s*\)/g)) {
    if (!PANEL_ALLOWED_TABLES.has(m[1])) {
      problems.push(`${file}: lee la tabla ${m[1]}`);
      continue;
    }
    // Solo lectura: la sentencia sigue con .select( y no escribe.
    const rest = src.slice(m.index + m[0].length).split(";")[0];
    if (!/^\s*\.select\(/.test(rest) || /\.(update|insert|upsert|delete)\(/.test(rest)) {
      problems.push(`${file}: ${m[1]} solo se puede leer con .select`);
    }
  }
  for (const m of src.matchAll(/\.rpc\b/g)) {
    const call = /^\(\s*["'`]([\w.]+)["'`]/.exec(src.slice(m.index + m[0].length));
    if (!call) problems.push(`${file}: llama un RPC sin nombre literal`);
    else if (!PANEL_ALLOWED_RPCS.has(call[1])) {
      problems.push(`${file}: llama el RPC ${call[1]} (no está en la lista permitida del panel)`);
    }
  }
  if (/\.storage\b/.test(src)) problems.push(`${file}: usa supabase.storage`);
  if (/\.functions\.invoke\b|supabase\.functions\b/.test(src)) {
    problems.push(`${file}: usa supabase.functions`);
  }
  if (/(^|[^\w.])fetch\(/.test(src)) problems.push(`${file}: usa fetch(`);
  if (AGENCY_PATHS.test(src)) problems.push(`${file}: enlaza a una ruta de agencia`);
  return problems;
}

{
  // Autotest de las reglas del panel.
  assert.deepEqual(
    panelFileProblems("ok.tsx", `import { Link } from "@tanstack/react-router";`),
    [],
  );
  assert.equal(
    panelFileProblems("x.tsx", `import { useActiveClient } from "@/contexts/ActiveClientContext";`)
      .length,
    1,
  );
  assert.equal(panelFileProblems("x.tsx", `import x from "@/lib/proposals/rut";`).length, 1);
  assert.equal(panelFileProblems("x.tsx", `const { clientId } = Route.useParams();`).length, 2);
  assert.equal(panelFileProblems("x.tsx", `supabase.from("payments").select("*")`).length, 1);
  assert.equal(panelFileProblems("x.tsx", `<Link to="/clients/$id" />`).length, 1);
  assert.deepEqual(
    panelFileProblems("src/routes/mi/$seccion.tsx", `const { seccion } = Route.useParams();`),
    [],
  );
  assert.deepEqual(panelFileProblems("x.tsx", `// clientId en un comentario\n`), []);
  assert.deepEqual(
    panelFileProblems("x.tsx", `supabase.from("client_users").select("panel_enabled").eq("a", 1);`),
    [],
  );
  assert.equal(
    panelFileProblems("x.tsx", `supabase.from("client_users").update({ panel_enabled: true });`)
      .length,
    1,
  );
  assert.equal(panelFileProblems("x.tsx", `supabase.storage.listBuckets()`).length, 1);
  assert.deepEqual(panelFileProblems("x.tsx", `supabase.rpc("client_leads_page" as never)`), []);
  assert.equal(panelFileProblems("x.tsx", `supabase.rpc("user_client_id")`).length, 1);
  assert.equal(panelFileProblems("x.tsx", `const r = supabase.rpc.bind(supabase)`).length, 1);
  assert.equal(panelFileProblems("x.tsx", `supabase.rpc(fn, args)`).length, 1);
  assert.equal(panelFileProblems("x.tsx", `supabase.functions.invoke("x")`).length, 1);
  assert.equal(panelFileProblems("x.tsx", `await fetch("/api/x")`).length, 1);
}

/* Imports transitivos: los módulos permitidos tampoco pueden arrastrar código prohibido. */

/** Imports con valor (sin `import type` / `export type`) de un archivo. */
function valueImports(rawSrc) {
  const src = stripJsComments(rawSrc);
  const specs = [];
  const re =
    /\b(?:import|export)\s+(?!type\b)(?:[\w*{}\s,$]+?\s+from\s+)?["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of src.matchAll(re)) specs.push(m[1] ?? m[2]);
  return specs;
}

/** Ruta en disco de un import local ("@/…" o relativo), o null si es un paquete. */
function resolveLocal(spec, fromFile) {
  let base;
  if (spec.startsWith("@/")) base = join(root, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(fromFile, "..", spec);
  else return null;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  return candidates.find((c) => /\.(ts|tsx)$/.test(c) && existsSync(c)) ?? null;
}

/** Módulos de servidor: en el navegador solo llega el stub RPC (tienen su propio control). */
const SERVER_BOUNDARY = /\.(functions|server)\.ts$/;

export function transitiveForbidden(entryFiles) {
  const problems = [];
  const seen = new Set();
  const queue = entryFiles.map((f) => ({ file: f, via: f }));
  while (queue.length > 0) {
    const { file, via } = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of valueImports(readFileSync(file, "utf8"))) {
      const alias = spec.startsWith(".")
        ? `@/${relative(join(root, "src"), resolve(file, "..", spec))}`
        : spec;
      if (PANEL_FORBIDDEN_IMPORTS.some((re) => re.test(alias))) {
        problems.push(
          `${relative(root, file)}: importa ${alias} (prohibido; llega al panel vía ${relative(root, via)})`,
        );
        continue;
      }
      const next = resolveLocal(spec, file);
      if (next && !SERVER_BOUNDARY.test(next)) queue.push({ file: next, via });
    }
  }
  return problems;
}

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

{
  const panelRoot = join(root, "src/components/client-panel");
  const routesRoot = join(root, "src/routes/mi");
  const layoutRoute = join(root, "src/routes/mi.tsx");
  const panelFiles = [layoutRoute, ...listFiles(routesRoot), ...listFiles(panelRoot)];
  for (const full of panelFiles) {
    const rel = full.slice(root.length + 1);
    for (const p of panelFileProblems(rel, readFileSync(full, "utf8"))) failures.push(p);
  }
  // Módulos fuera del panel que el panel importa (portal, perfil, app, lib…): su árbol
  // de imports tampoco puede llegar a piezas de agencia que leen tablas internas.
  const externalEntries = new Set();
  for (const full of panelFiles) {
    for (const spec of valueImports(readFileSync(full, "utf8"))) {
      const target = resolveLocal(spec, full);
      if (target && !target.startsWith(panelRoot) && !SERVER_BOUNDARY.test(target)) {
        externalEntries.add(target);
      }
    }
  }
  for (const p of transitiveForbidden([...externalEntries])) failures.push(p);

  // Guard: el layout /mi verifica el acceso y todas las rutas cuelgan de él.
  const layoutSrc = stripJsComments(readFileSync(layoutRoute, "utf8"));
  if (
    !/createFileRoute\(\s*["']\/mi["']\s*\)/.test(layoutSrc) ||
    !/beforeLoad[\s\S]*resolveClientShellAccess/.test(layoutSrc) ||
    !/component:\s*ClientPanelLayout\b/.test(layoutSrc)
  ) {
    failures.push("src/routes/mi.tsx: falta el guard (beforeLoad + ClientPanelLayout)");
  }
  const layoutCmp = stripJsComments(readFileSync(join(panelRoot, "ClientPanelLayout.tsx"), "utf8"));
  if (!/resolveClientShellAccess\(/.test(layoutCmp) || !/<Outlet\s*\/>/.test(layoutCmp)) {
    failures.push("ClientPanelLayout: el contenido (<Outlet />) no está detrás del guard");
  }
  for (const full of listFiles(routesRoot)) {
    const src = readFileSync(full, "utf8");
    if (!/createFileRoute\(\s*["']\/mi\//.test(src)) {
      failures.push(`${full.slice(root.length + 1)}: no es hija de /mi (sin guard)`);
    }
  }

  // Guard de agencia: un usuario cliente nunca ve /_app (va a /mi o /portal).
  const appSrc = stripJsComments(readFileSync(join(root, "src/routes/_app.tsx"), "utf8"));
  if ((appSrc.match(/clientHomeFor\(/g) ?? []).length < 2) {
    failures.push("src/routes/_app.tsx: el guard no manda al usuario cliente a su panel/portal");
  }
}

if (failures.length > 0) {
  console.error("check-aislamiento: FALLÓ (estático)");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `check-aislamiento: estático OK (${files.length} migraciones, ${vaultFns.length} funciones de vault sin exponer, panel del cliente aislado)`,
);

/* ───────────────────────── 2) Base de datos (opcional) ───────────────────────── */

const dbUrl = process.env.DATABASE_URL ?? "";
if (!dbUrl) {
  console.log(
    "check-aislamiento: sin DATABASE_URL, se omite la suite SQL (supabase/tests/aislamiento.sql)",
  );
  process.exit(0);
}
if (dbUrl.includes(PROD_PROJECT_REF)) {
  console.error(
    "check-aislamiento: DATABASE_URL apunta a PRODUCCIÓN. La suite crea datos de prueba (con ROLLBACK); córrela solo en staging o en una rama.",
  );
  process.exit(1);
}
const hasPsql = spawnSync("psql", ["--version"], { stdio: "ignore" }).status === 0;
if (!hasPsql) {
  console.error("check-aislamiento: hay DATABASE_URL pero no psql en el PATH");
  process.exit(1);
}
execFileSync(
  "psql",
  [dbUrl, "-v", "ON_ERROR_STOP=1", "-q", "-f", join(root, "supabase/tests/aislamiento.sql")],
  { stdio: "inherit" },
);
console.log("check-aislamiento: suite SQL OK");
