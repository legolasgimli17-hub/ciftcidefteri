declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import { LocalFarmRepository } from "../src/application/localFarmRepository";
import { createFarmTransaction } from "../src/domain/transaction";
import { createTransactionPartnership } from "../src/domain/partnership";
import { migrateDatabase } from "../src/storage/migrations";
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

const now = "2026-09-07T16:00:00.000Z";
const farmId = "farm-atomic-0001";
const partnerId = "partner-atomic-01";

async function seed(db: TestDatabase): Promise<void> {
  await migrateDatabase(db);
  await db.run(
    `INSERT INTO farmer_profiles
      (id,name,province,district,village,total_area_square_meters,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["profile-atomic-01", "Mehmet Kaya", "Diyarbakır", "Bismil", "Örnek", 100000, now, now]
  );
  await db.run(
    `INSERT INTO farms (id,owner_local_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    [farmId, "profile-atomic-01", "Benim Çiftliğim", now, now]
  );
  await db.run("INSERT INTO farm_crops (farm_id,crop_code,created_at) VALUES (?,?,?)", [farmId, "cotton", now]);
  await db.run(
    `INSERT INTO farm_partners (id,farm_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    [partnerId, farmId, "Ahmet Demir", now, now]
  );
}

function expense(id: string) {
  return createFarmTransaction({
    id,
    kind: "expense",
    amountKurus: 2_000_000,
    occurredOn: "2026-09-07",
    category: "Gübre",
    cropCode: "cotton"
  });
}

test("ortaklı kayıt işlem ve pay satırını tek transaction içinde yazar", async () => {
  const db = new TestDatabase();
  await seed(db);
  const repo = new LocalFarmRepository(db);

  await repo.addTransaction({
    farmId,
    transaction: expense("txn-atomic-good-01"),
    partnership: createTransactionPartnership({
      partnerId,
      ownerShareBasisPoints: 5000,
      cashActor: "owner"
    }),
    nowIso: now
  });

  assert.equal((await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM transactions"))?.count, 1);
  assert.equal((await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM transaction_partnerships"))?.count, 1);
  assert.equal((await db.all("PRAGMA foreign_key_check")).length, 0);
  db.close();
});

test("geçersiz ortak ortaklı kaydı yarım bırakmaz", async () => {
  const db = new TestDatabase();
  await seed(db);
  const repo = new LocalFarmRepository(db);

  await assert.rejects(
    () => repo.addTransaction({
      farmId,
      transaction: expense("txn-atomic-bad-001"),
      partnership: createTransactionPartnership({
        partnerId: "partner-missing-01",
        ownerShareBasisPoints: 5000,
        cashActor: "owner"
      }),
      nowIso: now
    }),
    /aktif değil/
  );

  assert.equal((await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM transactions"))?.count, 0);
  assert.equal((await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM transaction_partnerships"))?.count, 0);
  db.close();
});
