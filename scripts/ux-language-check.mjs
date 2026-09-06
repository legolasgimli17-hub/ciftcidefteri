import fs from "node:fs";
import path from "node:path";

const roots = ["app", "src/ui"];
const forbidden = [
  "mutabakat",
  "anapara bakiyesi",
  "zirai işletme hesabı",
  "senkronizasyon hatası",
  "gider kategorisi seçiniz",
  "yeni işlem kaydı oluştur"
];

const files = [];
for (const root of roots) walk(root);
let failed = false;
for (const file of files) {
  const text = fs.readFileSync(file, "utf8").toLocaleLowerCase("tr-TR");
  for (const phrase of forbidden) {
    if (text.includes(phrase)) {
      failed = true;
      console.error(`UX dili ihlali: ${file} -> ${phrase}`);
    }
  }
}
if (failed) process.exit(1);
console.log(`UX language gate: ${files.length} dosya temiz.`);

function walk(target) {
  if (!fs.existsSync(target)) return;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
}
