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
 *
 * 2) Base de datos (solo si hay DATABASE_URL y psql): ejecuta
 *    supabase/tests/aislamiento.sql (BEGIN … ROLLBACK). SOLO STAGING: se
 *    niega a correr contra el proyecto de producción.
 *
 * Uso: node scripts/check-aislamiento.mjs
 *      DATABASE_URL=postgres://…staging… node scripts/check-aislamiento.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
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

if (failures.length > 0) {
  console.error("check-aislamiento: FALLÓ (estático)");
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `check-aislamiento: estático OK (${files.length} migraciones, ${vaultFns.length} funciones de vault sin exponer)`,
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
