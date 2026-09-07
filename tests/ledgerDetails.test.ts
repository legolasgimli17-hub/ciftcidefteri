declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import { loadLedgerPartnershipDetails } from "../src/application/ledgerDetails";
import { migrateDatabase } from "../src/storage/migrations";
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
  public close(): void { this.db.close(); }
}

const NOW = "2026-09-07T18:00:00.000Z";
const FARM_ID = "farm-ledger-0001";

async function setup(): Promise<TestDatabase> {
  const db = new TestDatabase();
  await migrateDatabase(db);
  await db.run(
    `INSERT INTO farmer_profiles
      (id,name,province,district,village,total_area_square_meters,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["profile-ledger-0001", "Mehmet Kaya", "Diyarbakır", "Bismil", "Örnek", 100000, NOW, NOW]
  );
  await db.run(
    `INSERT INTO farms (id,owner_local_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    [FARM_ID, "profile-ledger-0001", "Benim Tarlam", NOW, NOW]
  );
  await db.run("INSERT INTO farm_crops (farm_id,crop_code,created_at) VALUES (?,?,?)", [FARM_ID, "cotton", NOW]);
  await db.run(
    `INSERT INTO farm_partners (id,farm_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    ["partner-ledger-0001", FARM_ID, "Ahmet Kaya", NOW, NOW]
  );
  await db.run(
    `INSERT INTO transactions
      (id,farm_id,kind,amount_kurus,occurred_on,category,crop_code,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    ["txn-ledger-000001", FARM_ID, "expense", 1800000, "2026-09-07", "Gübre", "cotton", NOW, NOW]
  );
  await db.run(
    `INSERT INTO transactions
      (id,farm_id,kind,amount_kurus,occurred_on,category,crop_code,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    ["txn-ledger-000002", FARM_ID, "expense", 450000, "2026-09-07", "Mazot", "cotton", NOW, NOW]
  );
  await db.run(
    `INSERT INTO transaction_partnerships
      (transaction_id,farm_id,partner_id,owner_share_basis_points,cash_actor,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    ["txn-ledger-000001", FARM_ID, "partner-ledger-0001", 6000, "owner", NOW, NOW]
  );
  return db;
}

test("defter ortaklık ayrıntılarını sayfadaki kayıtlar için tek bounded read modelde döndürür", async () => {
  const db = await setup();
  const details = await loadLedgerPartnershipDetails(db, FARM_ID, ["txn-ledger-000001", "txn-ledger-000002"]);
  assert.equal(details.size, 1);
  const detail = details.get("txn-ledger-000001");
  assert.equal(detail?.partnerName, "Ahmet Kaya");
  assert.equal(detail?.ownerShareBasisPoints, 6000);
  assert.equal(detail?.partnerShareBasisPoints, 4000);
  assert.equal(detail?.cashActor, "owner");
  assert.equal(details.has("txn-ledger-000002"), false);
  db.close();
});

test("defter ayrıntı okuması sınırsız işlem kimliği kabul etmez", async () => {
  const db = await setup();
  const ids = Array.from({ length: 41 }, (_, index) => `txn-limit-${String(index).padStart(4, "0")}`);
  await assert.rejects(() => loadLedgerPartnershipDetails(db, FARM_ID, ids), /en fazla 40/);
  db.close();
});
