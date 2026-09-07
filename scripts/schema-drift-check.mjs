import fs from "node:fs";
import path from "node:path";

const currentSource = fs.readFileSync("src/storage/schemaText.ts", "utf8");
const currentMatch = currentSource.match(/CURRENT_SCHEMA_SQL\s*=\s*String\.raw`([\s\S]*?)`;/);
if (!currentMatch) {
  console.error("Schema drift gate: güncel schemaText.ts okunamadı.");
  process.exit(1);
}

let failed = false;
const currentSchema = normalize(currentMatch[1]);
const schemaFile = normalize(fs.readFileSync("src/storage/schema.sql", "utf8"));
if (schemaFile !== currentSchema) {
  failed = true;
  console.error("Schema drift gate: src/storage/schema.sql güncel canonical şemadan farklı.");
}

const migrationSource = fs.readFileSync("src/storage/migrationSql.ts", "utf8");
const migrationMatches = [...migrationSource.matchAll(
  /export const MIGRATION_(\d{4})_SQL\s*=\s*String\.raw`([\s\S]*?)`;/g
)];
const migrationDir = "src/storage/migrations";
const migrationFiles = fs.readdirSync(migrationDir)
  .filter(name => /^\d{4}_.+\.sql$/.test(name))
  .sort();

if (migrationMatches.length !== migrationFiles.length) {
  failed = true;
  console.error("Schema drift gate: historical migration TS/SQL sayısı eşleşmiyor.");
}

for (const match of migrationMatches) {
  const version = match[1];
  const candidates = migrationFiles.filter(name => name.startsWith(`${version}_`));
  if (candidates.length !== 1) {
    failed = true;
    console.error(`Schema drift gate: ${version} migration SQL aynası tekil değil.`);
    continue;
  }
  const historical = normalize(match[2]);
  const filePath = path.join(migrationDir, candidates[0]);
  const mirror = normalize(fs.readFileSync(filePath, "utf8"));
  if (mirror !== historical) {
    failed = true;
    console.error(`Schema drift gate: ${filePath} immutable migration kaynağından farklı.`);
  }
}

if (failed) process.exit(1);
console.log(`Schema drift gate: güncel şema ve ${migrationFiles.length} historical migration aynası temiz.`);

function normalize(value) {
  return value.trim().replace(/\r\n/g, "\n");
}
