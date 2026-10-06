#!/usr/bin/env node
/**
 * "Archivos": subir y eliminar con autoría (agencia / cliente).
 *
 * Sin base de datos (CI): revisa
 *  1. Las reglas puras de src/lib/clientFiles/clientFiles.ts (tipos, tamaño,
 *     cuota de 5 GB, paths por cliente, quién puede eliminar).
 *  2. La lista de "Archivos" (archivosModel): lo subido por la agencia va con
 *     lo generado, lo del cliente a su pestaña, y solo lo propio es eliminable.
 *  3. Estático sobre la última migración de client_files: RLS de lectura
 *     (agencia o el propio cliente), sin escritura directa, reglas de borrado
 *     por autoría, RPC sin EXECUTE para anon, y que list_onboarding_orphans
 *     (su definición vigente) excluya payments.document_path y client_files.
 *  4. Estático sobre el servidor: toda función exportada resuelve el actor
 *     contra el cliente pedido y las RPC de escritura usan la sesión del
 *     usuario (no service_role), para que la BD vuelva a decidir.
 *
 * Uso: node scripts/check-archivos.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "archivos-check-"));

async function load(entry, name) {
  const outfile = join(outDir, `${name}.mjs`);
  await build({
    entryPoints: [join(root, entry)],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    alias: { "@": join(root, "src") },
    external: ["@supabase/*"],
    logLevel: "error",
  });
  return import(pathToFileURL(outfile).href);
}

const cf = await load("src/lib/clientFiles/clientFiles.ts", "clientFiles");
const model = await load("src/components/clients/archivos/archivosModel.ts", "archivosModel");
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const F = "33333333-3333-4333-8333-333333333333";
const MB = 1024 * 1024;
const GB = 1024 * MB;

// ── 1. Reglas puras ──────────────────────────────────────────────────────────

check("tipos permitidos y rechazados", () => {
  assert.equal(cf.clientFileMime("foto.jpg", "image/jpeg"), "image/jpeg");
  assert.equal(cf.clientFileMime("clip.MOV", ""), "video/quicktime");
  assert.equal(cf.clientFileMime("planilla.xlsx", ""), cf.clientFileMime("x.xlsx", ""));
  assert.equal(cf.clientFileMime("logo.svg", "image/svg+xml"), null);
  assert.equal(cf.clientFileMime("app.exe", "application/x-msdownload"), null);
  assert.equal(cf.clientFileMime("pagina.html", "text/html"), null);
  assert.equal(cf.clientFileProblem(null, 10), cf.CLIENT_FILE_ERRORS.badType);
});

check("tamaño por archivo: 200 MB", () => {
  assert.equal(cf.clientFileProblem("video/mp4", 200 * MB), null);
  assert.equal(cf.clientFileProblem("video/mp4", 200 * MB + 1), cf.CLIENT_FILE_ERRORS.tooBig);
  assert.equal(cf.clientFileProblem("video/mp4", 0), cf.CLIENT_FILE_ERRORS.empty);
});

check("cuota total: 5 GB por cliente", () => {
  assert.equal(cf.CLIENT_FILES_QUOTA_BYTES, 5 * GB);
  assert.equal(cf.fitsQuota(5 * GB - 10, 10), true);
  assert.equal(cf.fitsQuota(5 * GB - 10, 11), false);
  assert.match(cf.CLIENT_FILE_ERRORS.quota, /5 GB/);
});

check("paths: solo del cliente pedido y con forma exacta", () => {
  const p = cf.clientFilePath(A, F, "image/png");
  assert.equal(p, `archivos/${A}/${F}.png`);
  assert.equal(cf.isClientFilesPath(A, p), true);
  assert.equal(cf.isClientFilesPath(B, p), false, "path de otro cliente");
  assert.equal(cf.isClientFilesPath(A, `archivos/${A}/../${B}/${F}.png`), false);
  assert.equal(cf.isClientFilesPath(A, `${A}/${F}.png`), false, "onboarding no es archivos/");
  assert.equal(cf.isClientFilesPath(A, `documentos/${A}/${F}.pdf`), false);
  assert.equal(cf.isClientFilesPath("x", `archivos/x/${F}.png`), false);
});

check("nombre visible saneado", () => {
  assert.equal(cf.cleanFileName("C:\\fotos\\local.jpg"), "local.jpg");
  assert.equal(cf.cleanFileName("../../etc/passwd"), "passwd");
  assert.equal(cf.cleanFileName("   "), "archivo");
  assert.equal(cf.cleanFileName("a".repeat(400)).length, 160);
});

check("eliminar: cada lado solo lo suyo", () => {
  assert.equal(cf.canDeleteClientFile("agency", "agency"), true);
  assert.equal(cf.canDeleteClientFile("agency", "client"), false);
  assert.equal(cf.canDeleteClientFile("client", "client"), true);
  assert.equal(cf.canDeleteClientFile("client", "agency"), false);
  assert.equal(cf.canDeleteClientFile(null, "agency"), false, "viewer de la agencia");
});

check("motivos de rechazo → mensajes claros", () => {
  assert.equal(cf.registerProblem("quota"), cf.CLIENT_FILE_ERRORS.quota);
  assert.equal(cf.registerProblem("too_big"), cf.CLIENT_FILE_ERRORS.tooBig);
  assert.equal(cf.registerProblem("otra"), cf.CLIENT_FILE_ERRORS.generic);
  assert.equal(cf.formatBytes(1.25 * GB), "1,3 GB");
  assert.equal(cf.formatBytes(350 * MB), "350 MB");
});

// ── 2. Lista de "Archivos" ──────────────────────────────────────────────────

const stored = (
  id,
  kind,
  mime,
  canDelete,
  url = "https://x.supabase.co/storage/v1/object/sign/onboarding/a?token=t",
) => ({
  id,
  name: `archivo-${id}`,
  size: 10,
  mime,
  uploaderKind: kind,
  createdAt: "2026-10-01T12:00:00Z",
  url,
  canDelete,
});

check("agencia → galería de Vibranding; cliente → su pestaña", () => {
  const { agency, client } = model.splitStored([
    stored("a1", "agency", "image/png", true),
    stored("a2", "agency", "application/pdf", true),
    stored("c1", "client", "video/mp4", false),
    stored("c2", "client", "image/png", false, null),
  ]);
  assert.deepEqual(
    agency.map((f) => [f.id, f.kind, f.media]),
    [
      ["stored-a1", "upload", "image"],
      ["stored-a2", "document", "pdf"],
    ],
  );
  assert.deepEqual(
    client.map((f) => f.id),
    ["stored-c1"],
    "sin URL firmada no se lista",
  );
  assert.equal(agency[0].stored.canDelete, true);
  assert.equal(client[0].stored.canDelete, false);
});

check("subidos por el cliente: plataforma + onboarding, más nuevo primero", () => {
  const { client } = model.splitStored([stored("c1", "client", "image/png", true)]);
  const onboarding = [model.fromOnboardingPath(`${A}/${F}-logo.png`, "2026-09-01T00:00:00Z")];
  const rows = model.clientUploads(client, onboarding);
  assert.deepEqual(
    rows.map((r) => r.source),
    ["archivos", "onboarding"],
  );
  assert.equal(rows[1].file.name, "logo.png");
});

check("lo generado por otras fuentes nunca es eliminable", () => {
  const post = model.fromPost({
    id: "p1",
    caption: "Hola",
    format: "feed",
    type: "proposed",
    image_url: "https://cdn/x.jpg",
    cover_url: null,
    carousel_urls: [],
    published_at: null,
    scheduled_at: null,
    created_at: "2026-10-01T00:00:00Z",
    approval_status: null,
  });
  assert.equal(post.stored, undefined);
  const report = model.fromReport(
    { id: "r", period: "2026-09-01", token: "t", sent_at: "2026-10-01" },
    "2026-10-07",
  );
  assert.equal(report.stored, undefined);
});

check("descarga de URL firmada con nombre", () => {
  const href = model.downloadHref(
    "https://x.supabase.co/storage/v1/object/sign/onboarding/archivos/a/b.pdf?token=t",
    "Brief",
  );
  assert.match(href, /&download=Brief\.pdf$/);
});

// ── 3. Migración ────────────────────────────────────────────────────────────

const migrationsDir = join(root, "supabase/migrations");
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const sqlOf = (f) =>
  readFileSync(join(migrationsDir, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
const cfMigration = migrations.filter((f) => /client_files/i.test(sqlOf(f))).at(-1);

/** Cuerpo ($$ … $$) de la última definición de una función en todas las migraciones. */
function lastBody(fn) {
  let body = null;
  const re = new RegExp(
    `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${fn}\\s*\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`,
    "gi",
  );
  for (const f of migrations) {
    for (const m of sqlOf(f).matchAll(re)) body = m[1];
  }
  return body;
}

check("hay migración de client_files", () => assert.ok(cfMigration));
const sql = cfMigration ? sqlOf(cfMigration) : "";

check("RLS: lectura solo agencia dueña o el propio cliente", () => {
  assert.match(sql, /ALTER TABLE public\.client_files ENABLE ROW LEVEL SECURITY/);
  const policies = [...sql.matchAll(/CREATE POLICY[\s\S]*?ON public\.client_files([\s\S]*?);/g)];
  assert.equal(policies.length, 1, "una sola policy");
  assert.match(policies[0][1], /FOR SELECT TO authenticated/);
  assert.match(
    policies[0][1],
    /USING \(public\.owns_client\(client_id\) OR client_id = public\.user_client_id\(\)\)/,
  );
  assert.doesNotMatch(sql, /FOR (INSERT|UPDATE|DELETE|ALL)[^;]*client_files/);
  assert.match(sql, /REVOKE INSERT, UPDATE, DELETE[^;]*ON public\.client_files FROM authenticated/);
  assert.match(sql, /REVOKE ALL ON public\.client_files FROM anon/);
});

check("tabla: path atado al client_id y autoría válida", () => {
  assert.match(sql, /path ~ \('\^archivos\/' \|\| client_id::text/);
  assert.match(sql, /uploader_kind IN \('agency', 'client'\)/);
  assert.match(sql, /size <= 209715200/);
});

check("delete_client_file: agencia solo 'agency', cliente solo 'client' propio", () => {
  const body = lastBody("delete_client_file");
  assert.ok(body, "sin definición");
  assert.match(body, /WHERE id = _id AND client_id = _client_id/);
  assert.match(body, /WHEN 'agency' THEN public\.can_edit_client\(f\.client_id\)/);
  assert.match(body, /WHEN 'client' THEN f\.client_id = public\.user_client_id\(\)/);
  assert.match(body, /COALESCE\(allowed, false\)/);
  assert.match(body, /NOT COALESCE\(public\.owns_client/);
});

check("register_client_file: autoría desde auth.uid(), tamaño y cuota en la BD", () => {
  const body = lastBody("register_client_file");
  assert.ok(body, "sin definición");
  assert.match(body, /private\.client_file_actor_kind\(_client_id\)/);
  assert.match(body, /FOR UPDATE/);
  assert.match(body, /metadata->>'size'/);
  assert.match(body, /used \+ obj_size > quota/);
  assert.match(body, /obj_size > max_file/);
  assert.match(sql, /quota constant bigint := 5368709120/);
  const actor = sql.match(
    /FUNCTION private\.client_file_actor_kind[\s\S]*?\$\$([\s\S]*?)\$\$/,
  )?.[1];
  assert.match(actor, /can_edit_client\(_client_id\) THEN 'agency'/);
  assert.match(actor, /_client_id = public\.user_client_id\(\) THEN 'client'/);
});

check("RPC sin EXECUTE para anon y helpers privados cerrados", () => {
  for (const fn of [
    "client_files_usage\\(uuid\\)",
    "register_client_file\\(uuid, text, text\\)",
    "delete_client_file\\(uuid, uuid\\)",
  ]) {
    assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn} FROM PUBLIC, anon;`));
  }
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION private\.client_file_actor_kind\(uuid\) FROM PUBLIC, anon, authenticated/,
  );
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION private\.client_files_used_bytes\(uuid\) FROM PUBLIC, anon, authenticated/,
  );
});

check("limpieza del onboarding conserva lo referenciado", () => {
  const body = lastBody("list_onboarding_orphans");
  assert.ok(body, "sin definición");
  assert.match(body, /'reserva_vencida'/);
  assert.match(body, /client_intake ci, LATERAL unnest\(ci\.archivos\)/);
  assert.match(body, /payments p WHERE p\.document_path = o\.name/);
  assert.match(body, /client_files cf WHERE cf\.path = o\.name/);
  assert.match(body, /interval '48 hours'/);
});

check("no se crean buckets", () => {
  assert.doesNotMatch(sql, /INSERT INTO storage\.buckets/i);
  assert.doesNotMatch(sql, /create_bucket/i);
});

// ── 4. Servidor ─────────────────────────────────────────────────────────────

const server = readFileSync(join(root, "src/lib/clientFiles/clientFiles.server.ts"), "utf8");
const exported = [...server.matchAll(/export async function (\w+)\([\s\S]*?\n\}\n/g)].filter(
  (m) => m[1] !== "resolveActor",
);

check("cada acción resuelve el actor contra el cliente pedido", () => {
  assert.deepEqual(exported.map((m) => m[1]).sort(), [
    "confirmUpload",
    "createUploadSlot",
    "deleteFile",
    "listClientFiles",
  ]);
  for (const [body, name] of exported.map((m) => [m[0], m[1]])) {
    assert.match(
      body,
      /(resolveActor|assertCanUpload)\(userId, (clientId|input\.clientId)\)/,
      name,
    );
  }
});

check("escrituras por RPC con la sesión del usuario", () => {
  assert.match(server, /userDb\.rpc\("register_client_file"/);
  assert.match(server, /userDb\.rpc\("delete_client_file"/);
  assert.match(server, /userDb\s*\.from\("client_files"\)/);
  assert.doesNotMatch(server, /\(await admin\(\)\)\.rpc|db\.rpc\("(register|delete)_client_file/);
  assert.doesNotMatch(server, /from\("client_files"\)[\s\S]{0,80}\.(insert|delete|update)\(/);
});

check("Storage: solo se borran paths de ESTE cliente", () => {
  assert.match(server, /isClientFilesPath\(input\.clientId, res\.path\)/);
  assert.match(server, /isClientFilesPath\(input\.clientId, input\.path\)/);
});

if (failures.length > 0) {
  console.error(`check-archivos: ${failures.length} fallo(s)`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("check-archivos: OK");
