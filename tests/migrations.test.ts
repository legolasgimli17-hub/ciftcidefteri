declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import {
  migrateDatabase,
  runMigrations,
  validateMigrationPlan,
  type DatabaseMigration
} from "../src/storage/migrations";
import { SCHEMA_VERSION } from "../src/storage/schemaText";
import { type SqlDatabase, type SqlExecutor, type SqlPrimitive, type SqlRunResult } from "../src/storage/sql";

class NodeMigrationDatabase implements SqlDatabase {
  private readonly db = new DatabaseSync(":memory:");

  public constructor() {
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

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

  public foreignKeysEnabled(): boolean {
    const row = this.db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number } | undefined;
    return Number(row?.foreign_keys ?? 0) === 1;
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

test("foreign key kapatılması non-transactional migration için reddedilir", () => {
  assert.throws(
    () => validateMigrationPlan([
      { version: 1, sql: "SELECT 1;", transactional: false, requiresForeignKeysOff: true }
    ], 1),
    /transactional olmak zorunda/
  );
});

test("başarısız transactional migration yarım tablo ve sürüm bırakmaz", async () => {
  const db = new NodeMigrationDatabase();
  await assert.rejects(
    () => runMigrations(
      db,
      [{
        version: 1,
        transactional: true,
        sql: "CREATE TABLE partial_table (id INTEGER); THIS IS NOT VALID SQL;"
      }],
      1
    )
  );
  assert.equal(db.tableExists("partial_table"), false);
  assert.equal(
    await db.first<{ value: string }>("SELECT value FROM app_meta WHERE key='schema_version'"),
    null
  );
  db.close();
});

test("FK-safe rebuild parent tabloyu child kayıt kaybetmeden değiştirir", async () => {
  const db = new NodeMigrationDatabase();
  const v1: DatabaseMigration = {
    version: 1,
    transactional: true,
    sql: `
      CREATE TABLE parent_record (id TEXT PRIMARY KEY NOT NULL, phone TEXT NOT NULL);
      CREATE TABLE child_record (
        id TEXT PRIMARY KEY NOT NULL,
        parent_id TEXT NOT NULL REFERENCES parent_record(id) ON DELETE CASCADE
      );`
  };
  const v2: DatabaseMigration = {
    version: 2,
    transactional: true,
    requiresForeignKeysOff: true,
    sql: `
      CREATE TABLE parent_record_new (id TEXT PRIMARY KEY NOT NULL, phone TEXT);
      INSERT INTO parent_record_new (id, phone) SELECT id, phone FROM parent_record;
      DROP TABLE parent_record;
      ALTER TABLE parent_record_new RENAME TO parent_record;`
  };

  assert.equal(await runMigrations(db, [v1], 1), 1);
  await db.run("INSERT INTO parent_record (id, phone) VALUES (?, ?)", ["parent-1", "+905321234567"]);
  await db.run("INSERT INTO child_record (id, parent_id) VALUES (?, ?)", ["child-1", "parent-1"]);

  assert.equal(await runMigrations(db, [v1, v2], 2), 2);
  assert.equal(db.foreignKeysEnabled(), true);
  assert.deepEqual(
    await db.first<{ id: string; phone: string | null }>("SELECT id, phone FROM parent_record WHERE id='parent-1'"),
    { id: "parent-1", phone: "+905321234567" }
  );
  assert.deepEqual(
    await db.first<{ id: string; parent_id: string }>("SELECT id, parent_id FROM child_record WHERE id='child-1'"),
    { id: "child-1", parent_id: "parent-1" }
  );
  db.close();
});

test("FK ihlali yapan rebuild rollback olur, sürüm ve FK koruması geri gelir", async () => {
  const db = new NodeMigrationDatabase();
  const v1: DatabaseMigration = {
    version: 1,
    transactional: true,
    sql: `
      CREATE TABLE parent_record (id TEXT PRIMARY KEY NOT NULL, phone TEXT NOT NULL);
      CREATE TABLE child_record (
        id TEXT PRIMARY KEY NOT NULL,
        parent_id TEXT NOT NULL REFERENCES parent_record(id) ON DELETE CASCADE
      );`
  };
  const brokenV2: DatabaseMigration = {
    version: 2,
    transactional: true,
    requiresForeignKeysOff: true,
    sql: `
      CREATE TABLE parent_record_new (id TEXT PRIMARY KEY NOT NULL, phone TEXT);
      DROP TABLE parent_record;
      ALTER TABLE parent_record_new RENAME TO parent_record;`
  };

  assert.equal(await runMigrations(db, [v1], 1), 1);
  await db.run("INSERT INTO parent_record (id, phone) VALUES (?, ?)", ["parent-1", "+905321234567"]);
  await db.run("INSERT INTO child_record (id, parent_id) VALUES (?, ?)", ["child-1", "parent-1"]);

  await assert.rejects(() => runMigrations(db, [v1, brokenV2], 2), /foreign key bütünlüğünü bozuyor/);
  assert.equal(db.foreignKeysEnabled(), true);
  assert.deepEqual(
    await db.first<{ id: string }>("SELECT id FROM parent_record WHERE id='parent-1'"),
    { id: "parent-1" }
  );
  assert.deepEqual(
    await db.first<{ value: string }>("SELECT value FROM app_meta WHERE key='schema_version'"),
    { value: "1" }
  );
  db.close();
});
