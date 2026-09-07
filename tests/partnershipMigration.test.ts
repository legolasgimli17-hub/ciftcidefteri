declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import { DATABASE_MIGRATIONS, migrateDatabase, runMigrations } from "../src/storage/migrations";
import { type SqlDatabase, type SqlExecutor, type SqlPrimitive, type SqlRunResult } from "../src/storage/sql";

class TestDatabase implements SqlDatabase {
  private readonly db = new DatabaseSync(":memory:");

  public constructor() {
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

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

  public tableExists(name: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
  }

  public close(): void { this.db.close(); }
}

const now = "2026-09-07T12:00:00.000Z";

async function insertFarm(db: TestDatabase, suffix: string): Promise<{ farmId: string; transactionId: string }> {
  const profileId = `profile-${suffix}-0001`;
  const farmId = `farm-${suffix}-0000001`;
  const transactionId = `txn-${suffix}-00000001`;
  await db.run(
    `INSERT INTO farmer_profiles
      (id,name,province,district,village,total_area_square_meters,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [profileId, `Çiftçi ${suffix}`, "Diyarbakır", "Bismil", "Örnek", 100000, now, now]
  );
  await db.run(
    `INSERT INTO farms (id,owner_local_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    [farmId, profileId, `Çiftlik ${suffix}`, now, now]
  );
  await db.run(
    `INSERT INTO farm_crops (farm_id,crop_code,created_at) VALUES (?,?,?)`,
    [farmId, "cotton", now]
  );
  await db.run(
    `INSERT INTO transactions
      (id,farm_id,kind,amount_kurus,occurred_on,category,crop_code,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [transactionId, farmId, "expense", 2000000, "2026-09-07", "Gübre", "cotton", now, now]
  );
  return { farmId, transactionId };
}

test("v3 -> v4 ortaklık migrationı mevcut finans kaydını değiştirmez", async () => {
  const db = new TestDatabase();
  assert.equal(await runMigrations(db, DATABASE_MIGRATIONS.slice(0, 3), 3), 3);
  const before = await insertFarm(db, "a");

  assert.equal(await runMigrations(db, DATABASE_MIGRATIONS.slice(0, 4), 4), 4);
  assert.equal(db.tableExists("farm_partners"), true);
  assert.equal(db.tableExists("transaction_partnerships"), true);
  assert.equal(db.tableExists("debts"), false);
  assert.equal(
    (await db.first<{ amount_kurus: number }>("SELECT amount_kurus FROM transactions WHERE id=?", [before.transactionId]))?.amount_kurus,
    2000000
  );
  assert.equal((await db.all("PRAGMA foreign_key_check")).length, 0);
  db.close();
});

test("ortaklık satırı yalnız aynı çiftlikteki ortak ve işlem arasında kurulabilir", async () => {
  const db = new TestDatabase();
  await migrateDatabase(db);
  const a = await insertFarm(db, "a");
  const b = await insertFarm(db, "b");

  await db.run(
    `INSERT INTO farm_partners (id,farm_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    ["partner-b-0001", b.farmId, "Mehmet Kaya", now, now]
  );

  await assert.rejects(
    () => db.run(
      `INSERT INTO transaction_partnerships
        (transaction_id,farm_id,partner_id,owner_share_basis_points,cash_actor,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [a.transactionId, a.farmId, "partner-b-0001", 5000, "owner", now, now]
    ),
    /FOREIGN KEY/
  );
  db.close();
});

test("veritabanı geçersiz pay ve para aktörünü kabul etmez", async () => {
  const db = new TestDatabase();
  await migrateDatabase(db);
  const a = await insertFarm(db, "a");
  await db.run(
    `INSERT INTO farm_partners (id,farm_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    ["partner-a-0001", a.farmId, "Mehmet Kaya", now, now]
  );

  await assert.rejects(
    () => db.run(
      `INSERT INTO transaction_partnerships
        (transaction_id,farm_id,partner_id,owner_share_basis_points,cash_actor,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [a.transactionId, a.farmId, "partner-a-0001", 0, "owner", now, now]
    ),
    /CHECK/
  );

  await assert.rejects(
    () => db.run(
      `INSERT INTO transaction_partnerships
        (transaction_id,farm_id,partner_id,owner_share_basis_points,cash_actor,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?)`,
      [a.transactionId, a.farmId, "partner-a-0001", 5000, "someone", now, now]
    ),
    /CHECK/
  );
  db.close();
});
