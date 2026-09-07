import {
  BANK_MOVEMENTS_SQL,
  DEBT_LEDGER_SQL,
  INITIAL_SCHEMA_SQL,
  PARTNERSHIP_LEDGER_SQL,
  PROFILE_PHONE_REMOVAL_SQL,
  SCHEMA_VERSION,
  TRANSACTION_HISTORY_INDEX_SQL
} from "./schemaText";
import { type SqlDatabase, type SqlExecutor } from "./sql";

export interface DatabaseMigration {
  readonly version: number;
  readonly sql: string;
  readonly transactional: boolean;
}

const META_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`;

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  { version: 1, sql: INITIAL_SCHEMA_SQL, transactional: true },
  { version: 2, sql: TRANSACTION_HISTORY_INDEX_SQL, transactional: true },
  { version: 3, sql: PROFILE_PHONE_REMOVAL_SQL, transactional: true },
  { version: 4, sql: PARTNERSHIP_LEDGER_SQL, transactional: true },
  { version: 5, sql: DEBT_LEDGER_SQL, transactional: true },
  { version: 6, sql: BANK_MOVEMENTS_SQL, transactional: true }
];

export function validateMigrationPlan(
  migrations: readonly DatabaseMigration[],
  targetVersion: number
): void {
  if (!Number.isSafeInteger(targetVersion) || targetVersion < 1) {
    throw new Error("Hedef veritabanı sürümü geçersiz.");
  }
  if (migrations.length !== targetVersion) {
    throw new Error("Veritabanı migration zinciri eksik.");
  }
  migrations.forEach((migration, index) => {
    const expectedVersion = index + 1;
    if (migration.version !== expectedVersion || !migration.sql.trim()) {
      throw new Error(`Veritabanı migration sırası bozuk: ${expectedVersion}.`);
    }
  });
}

export async function migrateDatabase(database: SqlDatabase): Promise<number> {
  return runMigrations(database, DATABASE_MIGRATIONS, SCHEMA_VERSION);
}

export async function runMigrations(
  database: SqlDatabase,
  migrations: readonly DatabaseMigration[],
  targetVersion: number
): Promise<number> {
  validateMigrationPlan(migrations, targetVersion);
  await database.exec(META_TABLE_SQL);

  let currentVersion = await readSchemaVersion(database);
  if (currentVersion > targetVersion) {
    throw new Error("Veritabanı bu uygulamadan daha yeni. Güvenli düşürme yapılamaz.");
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;

    if (migration.transactional) {
      await database.transaction(async tx => {
        await tx.exec(migration.sql);
        await assertForeignKeyIntegrity(tx);
        await writeSchemaVersion(tx, migration.version);
      });
    } else {
      await database.exec(migration.sql);
      await assertForeignKeyIntegrity(database);
      await database.transaction(async tx => {
        await writeSchemaVersion(tx, migration.version);
      });
    }

    currentVersion = migration.version;
  }

  const finalVersion = await readSchemaVersion(database);
  if (finalVersion !== targetVersion) {
    throw new Error("Veritabanı migration işlemi tamamlanamadı.");
  }
  await assertForeignKeyIntegrity(database);
  return finalVersion;
}

async function assertForeignKeyIntegrity(database: SqlExecutor): Promise<void> {
  const violations = await database.all<{
    table: string;
    rowid: number | null;
    parent: string;
    fkid: number;
  }>("PRAGMA foreign_key_check");
  if (violations.length !== 0) {
    throw new Error("Veritabanı ilişkilerinde bozulma bulundu. Migration tamamlanmadı.");
  }
}

async function readSchemaVersion(database: SqlExecutor): Promise<number> {
  const row = await database.first<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'schema_version'"
  );
  if (row === null) return 0;
  if (!/^[0-9]+$/.test(row.value)) {
    throw new Error("Veritabanı sürüm bilgisi bozuk.");
  }
  const version = Number(row.value);
  if (!Number.isSafeInteger(version) || version < 0) {
    throw new Error("Veritabanı sürüm bilgisi geçersiz.");
  }
  return version;
}

async function writeSchemaVersion(database: SqlExecutor, version: number): Promise<void> {
  await database.run(
    `INSERT INTO app_meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(version)]
  );
}
