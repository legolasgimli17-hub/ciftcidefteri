declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import { migrateDatabase, validateMigrationPlan } from "../src/storage/migrations";
import { SCHEMA_VERSION } from "../src/storage/schemaText";
import { type SqlDatabase, type SqlExecutor, type SqlPrimitive, type SqlRunResult } from "../src/storage/sql";

class NodeMigrationDatabase implements SqlDatabase {
  private readonly db = new DatabaseSync(":memory:");

  public async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  public async run(sql: string, params: readonly SqlPrimitive[] = []): Promise<SqlRunResult> {
    const result = this.db.prepare(sql).run(...params);
    return { changes: Number(result.changes) };
  }

  public async first<T extends object>(sql: string, params: readonly SqlPrimitive[] = []): Promise<T | null> {
    return (this.db.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  public async all<T extends object>(sql: string, params: readonly SqlPrimitive[] = []): Promise<readonly T[]> {
    return this.db.prepare(sql).all(...params) as readonly T[];
  }

  public async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = await work(this);
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  public setSchemaVersion(value: string): void {
    this.db.exec("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)");
    this.db.prepare(`INSERT INTO app_meta (key,value) VALUES ('schema_version',?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(value);
  }

  public tableExists(name: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
  }

  public close(): void {
    this.db.close();
  }
}

test("migration runner boş veritabanını güncel şemaya getirir", async () => {
  const db = new NodeMigrationDatabase();
  const version = await migrateDatabase(db);
  assert.equal(version, SCHEMA_VERSION);
  assert.equal(db.tableExists("transactions"), true);
  db.close();
});

test("migration runner tekrar çalıştırıldığında idempotent kalır", async () => {
  const db = new NodeMigrationDatabase();
  assert.equal(await migrateDatabase(db), SCHEMA_VERSION);
  assert.equal(await migrateDatabase(db), SCHEMA_VERSION);
  db.close();
});

test("uygulamadan daha yeni veritabanı güvenli şekilde reddedilir", async () => {
  const db = new NodeMigrationDatabase();
  db.setSchemaVersion(String(SCHEMA_VERSION + 1));
  await assert.rejects(() => migrateDatabase(db), /daha yeni/);
  db.close();
});

test("bozuk schema_version sessizce sıfırlanmaz", async () => {
  const db = new NodeMigrationDatabase();
  db.setSchemaVersion("broken");
  await assert.rejects(() => migrateDatabase(db), /bozuk/);
  db.close();
});

test("migration zincirindeki sürüm boşluğu release'i engeller", () => {
  assert.throws(
    () => validateMigrationPlan([{ version: 2, sql: "SELECT 1;", transactional: true }], 1),
    /sırası bozuk/
  );
});
