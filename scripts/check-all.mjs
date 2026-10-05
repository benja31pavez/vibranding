// Ejecuta en orden todos los scripts "check:*" de package.json (menos check:all),
// así un check nuevo queda incluido en CI sin tocar este archivo.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const checks = Object.keys(pkg.scripts ?? {}).filter(
  (name) => name.startsWith("check:") && name !== "check:all",
);

if (checks.length === 0) {
  console.error("check-all: no hay scripts check:*");
  process.exit(1);
}
for (const name of checks) {
  console.log(`\n▶ ${name}`);
  execSync(`npm run -s ${name}`, { stdio: "inherit" });
}
console.log(`\ncheck-all: OK (${checks.length} checks)`);
