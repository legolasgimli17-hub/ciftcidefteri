import fs from "node:fs";
import path from "node:path";

const roots = ["app", "src", "scripts"];
const files = [];
for (const root of roots) walk(root);

const rules = [
  { name: "service-role secret", pattern: /service[_-]?role/i },
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "eval", pattern: /\beval\s*\(/ },
  { name: "new Function", pattern: /\bnew\s+Function\s*\(/ },
  { name: "hardcoded JWT", pattern: /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}/ }
];

let failed = false;
for (const file of files) {
  if (file.endsWith("static-security-check.mjs")) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      failed = true;
      console.error(`Security gate: ${rule.name} bulundu -> ${file}`);
    }
  }
  if (/amount_[a-z_]*\s+REAL/i.test(text) || /money_[a-z_]*\s+REAL/i.test(text)) {
    failed = true;
    console.error(`Security/data gate: finans alanında REAL bulundu -> ${file}`);
  }
}
if (failed) process.exit(1);
console.log(`Static security gate: ${files.length} dosya temiz.`);

function walk(target) {
  if (!fs.existsSync(target)) return;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs|sql|json)$/.test(entry.name)) files.push(full);
  }
}
