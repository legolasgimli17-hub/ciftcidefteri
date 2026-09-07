import { MIGRATION_0001_SQL } from "./migrationSql";
import { SCHEMA_VERSION } from "./schemaText";
import { type SqlDatabase, type SqlExecutor } from "./sql";

export interface DatabaseMigration {
  readonly version: number;
  readonly sql: string;
  readonly transactional: boolean;
  readonly requiresForeignKeysOff?: boolean;
}

const META_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`;

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    version: 1,
    sql: MIGRATION_0001_SQL,
    transactional: true
  }
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
    if (migration.requiresForeignKeysOff === true && migration.transactional !== true) {
      throw new Error("Foreign key kapatılan migration transactional olmak zorunda.");
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
    await applyMigration(database, migration);
    currentVersion = migration.version;
  }

  const finalVersion = await readSchemaVersion(database);
  if (finalVersion !== targetVersion) {
    throw new Error("Veritabanı migration işlemi tamamlanamadı.");
  }
  return finalVersion;
}

async function applyMigration(database: SqlDatabase, migration: DatabaseMigration): Promise<void> {
  if (migration.requiresForeignKeysOff === true) {
    await applyForeignKeyRebuildMigration(database, migration);
    return;
  }

  if (migration.transactional) {
    await database.transaction(async tx => {
      await tx.exec(migration.sql);
      await writeSchemaVersion(tx, migration.version);
    });
    return;
  }

  await database.exec(migration.sql);
  await database.transaction(async tx => {
    await writeSchemaVersion(tx, migration.version);
  });
}

async function applyForeignKeyRebuildMigration(
  database: SqlDatabase,
  migration: DatabaseMigration
): Promise<void> {
  await assertForeignKeysState(database, true);
  await setForeignKeys(database, false);
  try {
    await database.transaction(async tx => {
      await tx.exec(migration.sql);
      await assertNoForeignKeyViolations(tx);
      await writeSchemaVersion(tx, migration.version);
    });
  } finally {
    await setForeignKeys(database, true);
    await assertForeignKeysState(database, true);
  }
}

async function setForeignKeys(database: SqlExecutor, enabled: boolean): Promise<void> {
  await database.exec(enabled ? "PRAGMA foreign_keys = ON;" : "PRAGMA foreign_keys = OFF;");
  await assertForeignKeysState(database, enabled);
}

async function assertForeignKeysState(database: SqlExecutor, expected: boolean): Promise<void> {
  const row = await database.first<{ foreign_keys: number }>("PRAGMA foreign_keys;");
  const actual = Number(row?.foreign_keys ?? -1);
  if (actual !== (expected ? 1 : 0)) {
    throw new Error("Veritabanı foreign key koruması beklenen duruma getirilemedi.");
  }
}

async function assertNoForeignKeyViolations(database: SqlExecutor): Promise<void> {
  const violation = await database.first<{ table: string }>("PRAGMA foreign_key_check;");
  if (violation !== null) {
    throw new Error("Migration foreign key bütünlüğünü bozuyor.");
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
