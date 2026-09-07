declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import { DATABASE_MIGRATIONS, migrateDatabase, runMigrations } from "../src/storage/migrations";
import { type SqlDatabase, type SqlExecutor, type SqlPrimitive, type SqlRunResult } from "../src/storage/sql";

class TestDatabase implements SqlDatabase {
  private readonly db = new DatabaseSync(":memory:");
  public constructor() { this.db.exec("PRAGMA foreign_keys = ON;"); }
  public async exec(sql: string): Promise<void> { this.db.exec(sql); }
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
  public close(): void { this.db.close(); }
}

test("v6 veritabanı stok tabloları eklenirken banka ve finans kaydını korur", async () => {
  const db = new TestDatabase();
  assert.equal(await runMigrations(db, DATABASE_MIGRATIONS.slice(0, 6), 6), 6);
  const now = "2026-09-07T20:30:00.000Z";

  await db.run(
    `INSERT INTO farmer_profiles
      (id,name,province,district,village,total_area_square_meters,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["profile-v6-stock", "Mehmet Kaya", "Diyarbakır", "Bismil", "Örnek", 100000, now, now]
  );
  await db.run(
    "INSERT INTO farms (id,owner_local_id,display_name,created_at,updated_at) VALUES (?,?,?,?,?)",
    ["farm-v6-stock-01", "profile-v6-stock", "Benim Tarlam", now, now]
  );
  await db.run(
    "INSERT INTO farm_crops (farm_id,crop_code,created_at) VALUES (?,?,?)",
    ["farm-v6-stock-01", "wheat", now]
  );
  await db.run(
    `INSERT INTO transactions
      (id,farm_id,kind,amount_kurus,occurred_on,category,crop_code,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    ["txn-v6-stock-001", "farm-v6-stock-01", "income", 450000, "2026-09-07", "Ürün satışı", "wheat", now, now]
  );
  await db.run(
    `INSERT INTO bank_movements
      (id,farm_id,kind,amount_kurus,occurred_on,bank_name,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["bankmove-v6-001", "farm-v6-stock-01", "withdrawal", 125000, "2026-09-07", "Ziraat Bankası", now, now]
  );

  assert.equal(await migrateDatabase(db), 7);
  assert.equal(
    (await db.first<{ amount_kurus: number }>("SELECT amount_kurus FROM transactions WHERE id=?", ["txn-v6-stock-001"]))?.amount_kurus,
    450000
  );
  assert.equal(
    (await db.first<{ amount_kurus: number }>("SELECT amount_kurus FROM bank_movements WHERE id=?", ["bankmove-v6-001"]))?.amount_kurus,
    125000
  );
  assert.equal(
    (await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='inventory_items'"))?.count,
    1
  );
  assert.equal(
    (await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='inventory_movements'"))?.count,
    1
  );
  assert.equal(
    (await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='index' AND name='idx_inventory_movements_item_date'"))?.count,
    1
  );
  assert.equal((await db.all("PRAGMA foreign_key_check")).length, 0);
  db.close();
});
