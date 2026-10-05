#!/usr/bin/env node
/**
 * Revisa los mensajes de "Recordar pago" (src/lib/billing/reminders.ts).
 * Uso: node scripts/check-reminders.mjs
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = resolve(import.meta.dirname, "..");
const outDir = mkdtempSync(join(tmpdir(), "reminders-check-"));
const outFile = join(outDir, "reminders.mjs");

await build({
  entryPoints: [join(root, "src/lib/billing/reminders.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: outFile,
  alias: { "@": join(root, "src") },
  logLevel: "error",
});

const r = await import(pathToFileURL(outFile).href);
rmSync(outDir, { recursive: true, force: true });

const failures = [];
function check(name, fn) {
  try {
    fn();
  } catch (e) {
    failures.push(`${name}: ${e.message}`);
  }
}

const TODAY = "2026-10-20";
const pay = (over = {}) => ({
  id: "p1",
  status: "pending",
  amount: 149990,
  description: "Plan Crecimiento octubre",
  due_date: TODAY,
  payment_url: null,
  ...over,
});
const msg = (over, extra = {}) => r.buildReminder({ payment: pay(over), clientName: "Panadería Sol", today: TODAY, ...extra });

// Etapas
check("antes del vencimiento = amable", () => assert.equal(r.reminderStage(pay({ due_date: "2026-10-25" }), TODAY), "amable"));
check("el día = hoy", () => assert.equal(r.reminderStage(pay(), TODAY), "hoy"));
check("+3 días = vencido", () => assert.equal(r.reminderStage(pay({ due_date: "2026-10-17" }), TODAY), "vencido"));
check("+7 días = firme", () => assert.equal(r.reminderStage(pay({ due_date: "2026-10-13" }), TODAY), "firme"));
check("+14 días = firme", () => assert.equal(r.reminderStage(pay({ due_date: "2026-10-06" }), TODAY), "firme"));
check("+15 días = pausa", () => assert.equal(r.reminderStage(pay({ due_date: "2026-10-05" }), TODAY), "pausa"));
check("cruza cambio de mes y año", () => assert.equal(r.daysUntilDue("2027-01-02", "2026-12-30"), 3));

// Mensaje
check("incluye cliente, concepto, monto CLP, fecha y link", () => {
  const m = msg({});
  assert.match(m.body, /Panadería Sol/);
  assert.match(m.body, /Plan Crecimiento octubre/);
  assert.match(m.body, /\$149\.990/);
  assert.match(m.body, /20 de octubre de 2026/);
  assert.match(m.body, /https:\/\/vibranding\.pro\/portal#pagos/);
});
check("usa el link de Flow si existe", () => {
  const m = msg({ payment_url: "https://www.flow.cl/app/web/pay.php?token=abc" });
  assert.equal(m.link, "https://www.flow.cl/app/web/pay.php?token=abc");
  assert.match(m.body, /flow\.cl/);
});
check("ignora links no https", () => assert.equal(msg({ payment_url: "javascript:alert(1)" }).link, r.PORTAL_PAYMENTS_URL));
check("saluda al contacto por su nombre", () => assert.match(msg({}, { contactName: "María José Pérez" }).body, /^Hola María,/));
check("aviso de pausa a +15", () => {
  const m = msg({ due_date: "2026-10-01", status: "overdue" });
  assert.equal(m.stage, "pausa");
  assert.match(m.body, /pausar/);
  assert.match(m.body, /19 días de atraso/);
});
check("firme menciona días de atraso", () => assert.match(msg({ due_date: "2026-10-10" }).body, /10 días de atraso/));
check("mañana", () => assert.match(msg({ due_date: "2026-10-21" }).body, /vence mañana/));
check("sin vencimiento no rompe", () => assert.match(msg({ due_date: null }).body, /está pendiente/));
check("sin concepto usa genérico", () => assert.match(msg({ description: "  " }).body, /servicios Vibranding/));
check("sin palabras de garantía o reembolso", () => {
  for (const due of ["2026-10-25", TODAY, "2026-10-17", "2026-10-10", "2026-09-01"]) {
    const m = msg({ due_date: due });
    assert.doesNotMatch(`${m.subject} ${m.body}`, /garant|reembols|devoluci/i);
  }
});

// Urgencia
check("ordena por urgencia y excluye lejanos/pagados", () => {
  const rows = [
    pay({ id: "lejos", due_date: "2026-12-01" }),
    pay({ id: "pronto", due_date: "2026-10-22" }),
    pay({ id: "pagado", status: "paid", due_date: "2026-09-01" }),
    pay({ id: "atrasado", due_date: "2026-10-01" }),
    pay({ id: "hoy", due_date: TODAY }),
  ];
  assert.deepEqual(r.sortByUrgency(rows, TODAY).map((x) => x.id), ["atrasado", "hoy", "pronto"]);
});

// Links
check("wa.me con teléfono chileno y texto codificado", () =>
  assert.equal(r.reminderWhatsappHref("+56 9 1234 5678", "Hola & chao"), "https://wa.me/56912345678?text=Hola%20%26%20chao"));
check("celular sin código de país", () => assert.match(r.reminderWhatsappHref("912345678", "x"), /wa\.me\/56912345678/));
check("teléfono inválido = null", () => assert.equal(r.reminderWhatsappHref("123", "x"), null));
check("mailto codificado", () =>
  assert.equal(r.reminderMailtoHref("a@b.cl", "Pago & más", "L1\nL2"), "mailto:a%40b.cl?subject=Pago%20%26%20m%C3%A1s&body=L1%0AL2"));
check("mailto descarta correo inválido", () => assert.match(r.reminderMailtoHref("no es correo?x", "s", "b"), /^mailto:\?subject=/));

// localStorage
check("recordado solo vale hoy", () => {
  const map = r.parseReminded(JSON.stringify({ a: TODAY, b: "2026-10-19", c: 3 }), TODAY);
  assert.deepEqual(map, { a: TODAY });
  assert.equal(r.wasRemindedToday(r.withReminded(map, "d", TODAY), "d", TODAY), true);
});
check("basura en storage = vacío", () => assert.deepEqual(r.parseReminded("{no json", TODAY), {}));
check("clave por usuario", () => assert.equal(r.remindedStorageKey("u1"), "vb:cobros:recordado-hoy:u1"));

if (failures.length > 0) {
  console.error(`check-reminders: ${failures.length} problema(s)`);
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}
console.log("check-reminders: OK");
