declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import { LocalTransactionHistory } from "../src/application/transactionHistory";
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

const FARM_ID = "farm-filter-0001";
const PARTNER_ID = "partner-filter-0001";

async function setup(): Promise<TestDatabase> {
  const db = new TestDatabase();
  await migrateDatabase(db);
  const now = "2026-09-07T18:00:00.000Z";
  await db.run(
    `INSERT INTO farmer_profiles
      (id,name,province,district,village,total_area_square_meters,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["profile-filter-0001", "Mehmet Kaya", "Diyarbakır", "Bismil", "Örnek", 100000, now, now]
  );
  await db.run(
    `INSERT INTO farms (id,owner_local_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    [FARM_ID, "profile-filter-0001", "Benim Tarlam", now, now]
  );
  await db.run("INSERT INTO farm_crops (farm_id,crop_code,created_at) VALUES (?,?,?)", [FARM_ID, "cotton", now]);
  await db.run("INSERT INTO farm_crops (farm_id,crop_code,created_at) VALUES (?,?,?)", [FARM_ID, "corn", now]);
  await db.run(
    `INSERT INTO farm_partners (id,farm_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    [PARTNER_ID, FARM_ID, "Ahmet Kaya", now, now]
  );

  const rows = [
    ["txn-filter-000001", "expense", 100000, "2026-09-07", "Gübre", "cotton", "2026-09-07T18:00:03.000Z"],
    ["txn-filter-000002", "expense", 200000, "2026-09-06", "Gübre", "cotton", "2026-09-07T18:00:02.000Z"],
    ["txn-filter-000003", "expense", 300000, "2026-09-05", "Mazot", "corn", "2026-09-07T18:00:01.000Z"],
    ["txn-filter-000004", "income", 900000, "2026-09-04", "Ürün satışı", "cotton", "2026-09-07T18:00:00.000Z"]
  ] as const;
  for (const row of rows) {
    await db.run(
      `INSERT INTO transactions
        (id,farm_id,kind,amount_kurus,occurred_on,category,crop_code,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [row[0], FARM_ID, row[1], row[2], row[3], row[4], row[5], row[6], row[6]]
    );
  }
  await db.run(
    `INSERT INTO transaction_partnerships
      (transaction_id,farm_id,partner_id,owner_share_basis_points,cash_actor,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    ["txn-filter-000001", FARM_ID, PARTNER_ID, 5000, "owner", now, now]
  );
  return db;
}

test("defter tür, ürün, kategori, ortak ve tarih filtrelerini SQL seviyesinde uygular", async () => {
  const db = await setup();
  const history = new LocalTransactionHistory(db);
  const page = await history.page({
    farmId: FARM_ID,
    filter: {
      kind: "expense",
      cropCode: "cotton",
      category: "Gübre",
      partnerId: PARTNER_ID,
      fromOn: "2026-09-06",
      toOn: "2026-09-07"
    }
  });
  assert.deepEqual(page.items.map((item) => item.id), ["txn-filter-000001"]);
  db.close();
});

test("filtreli cursor sayfalaması filtre dışı kaydı sonraki sayfaya sızdırmaz", async () => {
  const db = await setup();
  const history = new LocalTransactionHistory(db);
  const first = await history.page({
    farmId: FARM_ID,
    limit: 1,
    filter: { kind: "expense", cropCode: "cotton", category: "Gübre" }
  });
  assert.deepEqual(first.items.map((item) => item.id), ["txn-filter-000001"]);
  assert.ok(first.nextCursor);

  const second = await history.page({
    farmId: FARM_ID,
    limit: 1,
    cursor: first.nextCursor,
    filter: { kind: "expense", cropCode: "cotton", category: "Gübre" }
  });
  assert.deepEqual(second.items.map((item) => item.id), ["txn-filter-000002"]);
  assert.equal(second.nextCursor, undefined);
  db.close();
});

test("defter filtresi ters tarih aralığını reddeder", async () => {
  const db = await setup();
  const history = new LocalTransactionHistory(db);
  await assert.rejects(
    () => history.page({ farmId: FARM_ID, filter: { fromOn: "2026-09-07", toOn: "2026-09-01" } }),
    /Başlangıç tarihi/
  );
  db.close();
});
