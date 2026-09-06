import fs from "node:fs";

const source = fs.readFileSync("src/storage/schemaText.ts", "utf8");
const match = source.match(/INITIAL_SCHEMA_SQL\s*=\s*String\.raw`([\s\S]*?)`;/);
if (!match) {
  console.error("Schema drift gate: schemaText.ts okunamadı.");
  process.exit(1);
}
const canonical = normalize(match[1]);
const mirrors = ["src/storage/schema.sql", "src/storage/migrations/0001_initial.sql"];
let failed = false;
for (const mirror of mirrors) {
  const actual = normalize(fs.readFileSync(mirror, "utf8"));
  if (actual !== canonical) {
    failed = true;
    console.error(`Schema drift gate: ${mirror} canonical şemadan farklı.`);
  }
}
if (failed) process.exit(1);
console.log("Schema drift gate: SQL aynaları canonical şema ile aynı.");

function normalize(value) {
  return value.trim().replace(/\r\n/g, "\n");
}
