import fs from "node:fs";

const source = fs.readFileSync("src/storage/schemaText.ts", "utf8");
let failed = false;

checkConstantMirror(
  "INITIAL_SCHEMA_SQL",
  ["src/storage/schema.sql", "src/storage/migrations/0001_initial.sql"]
);
checkConstantMirror(
  "TRANSACTION_HISTORY_INDEX_SQL",
  ["src/storage/migrations/0002_transaction_history_index.sql"]
);

if (failed) process.exit(1);
console.log("Schema drift gate: başlangıç şeması ve migration SQL aynaları doğru.");

function checkConstantMirror(constantName, mirrors) {
  const pattern = new RegExp(`${constantName}\\s*=\\s*String\\.raw\\\`([\\s\\S]*?)\\\`;`);
  const match = source.match(pattern);
  if (!match) {
    failed = true;
    console.error(`Schema drift gate: ${constantName} okunamadı.`);
    return;
  }

  const canonical = normalize(match[1]);
  for (const mirror of mirrors) {
    const actual = normalize(fs.readFileSync(mirror, "utf8"));
    if (actual !== canonical) {
      failed = true;
      console.error(`Schema drift gate: ${mirror} ${constantName} ile farklı.`);
    }
  }
}

function normalize(value) {
  return value.trim().replace(/\r\n/g, "\n");
}
