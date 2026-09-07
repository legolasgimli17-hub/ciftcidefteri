declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import { LocalFarmRepository } from "../src/application/localFarmRepository";
import { LocalPartnershipRepository } from "../src/application/localPartnershipRepository";
import { LocalTransactionCorrections } from "../src/application/transactionCorrections";
import { squareMetersFromUserInput } from "../src/domain/landArea";
import { createFarmPartner } from "../src/domain/partner";
import { createTransactionPartnership } from "../src/domain/partnership";
import { createFarmerProfile } from "../src/domain/profile";
import { createFarmTransaction } from "../src/domain/transaction";
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

const FARM_ID = "farm-correct-0001";
const PARTNER_ID = "partner-correct-0001";
const TX_ID = "txn-correct-00001";
const NOW = "2026-09-07T16:00:00.000Z";
const LATER = "2026-09-07T17:00:00.000Z";

async function setup() {
  const db = new TestDatabase();
  await migrateDatabase(db);
  const farm = new LocalFarmRepository(db);
  await farm.saveInitialFarm({
    profile: createFarmerProfile({
      id: "profile-correct-0001",
      name: "Mehmet Kaya",
      province: "Diyarbakır",
      district: "Bismil",
      village: "Örnek",
      totalAreaSquareMeters: squareMetersFromUserInput("100", "decare"),
      cropCodes: ["cotton"]
    }),
    farmId: FARM_ID,
    farmName: "Benim Tarlam",
    nowIso: NOW
  });

  const partnershipRepo = new LocalPartnershipRepository(db);
  await partnershipRepo.addPartner({
    farmId: FARM_ID,
    partner: createFarmPartner({ id: PARTNER_ID, name: "Ahmet Kaya" }),
    nowIso: NOW
  });

  const transaction = createFarmTransaction({
    id: TX_ID,
    kind: "expense",
    amountKurus: 2_000_000,
    occurredOn: "2026-09-07",
    category: "Gübre",
    cropCode: "cotton",
    note: "İlk kayıt"
  });
  await farm.addTransaction({
    farmId: FARM_ID,
    transaction,
    partnership: createTransactionPartnership({
      partnerId: PARTNER_ID,
      ownerShareBasisPoints: 5_000,
      cashActor: "owner"
    }),
    nowIso: NOW
  });
  return { db, farm };
}

test("işlem ve ortaklık düzeltmesi aynı transaction içinde birlikte güncellenir", async () => {
  const { db } = await setup();
  const corrections = new LocalTransactionCorrections(db);
  const updated = createFarmTransaction({
    id: TX_ID,
    kind: "expense",
    amountKurus: 2_400_000,
    occurredOn: "2026-09-08",
    category: "Gübre",
    cropCode: "cotton",
    note: "Düzeltilmiş kayıt"
  });

  assert.equal(await corrections.updateTransaction({
    farmId: FARM_ID,
    transaction: updated,
    partnership: createTransactionPartnership({
      partnerId: PARTNER_ID,
      ownerShareBasisPoints: 6_000,
      cashActor: "partner"
    }),
    nowIso: LATER
  }), true);

  const stored = await db.first<{ amount_kurus: number; note: string }>(
    "SELECT amount_kurus, note FROM transactions WHERE id=?", [TX_ID]
  );
  const link = await db.first<{ owner_share_basis_points: number; cash_actor: string }>(
    "SELECT owner_share_basis_points, cash_actor FROM transaction_partnerships WHERE transaction_id=?", [TX_ID]
  );
  assert.equal(stored?.amount_kurus, 2_400_000);
  assert.equal(stored?.note, "Düzeltilmiş kayıt");
  assert.equal(link?.owner_share_basis_points, 6_000);
  assert.equal(link?.cash_actor, "partner");
  db.close();
});

test("geçersiz ortak düzeltmesi işlem tutarını da değiştirmeden rollback olur", async () => {
  const { db } = await setup();
  const corrections = new LocalTransactionCorrections(db);
  const updated = createFarmTransaction({
    id: TX_ID,
    kind: "expense",
    amountKurus: 9_999_999,
    occurredOn: "2026-09-08",
    category: "Mazot",
    cropCode: "cotton"
  });

  await assert.rejects(() => corrections.updateTransaction({
    farmId: FARM_ID,
    transaction: updated,
    partnership: createTransactionPartnership({
      partnerId: "partner-missing-0001",
      ownerShareBasisPoints: 5_000,
      cashActor: "owner"
    }),
    nowIso: LATER
  }));

  const stored = await db.first<{ amount_kurus: number; category: string }>(
    "SELECT amount_kurus, category FROM transactions WHERE id=?", [TX_ID]
  );
  const link = await db.first<{ partner_id: string; owner_share_basis_points: number }>(
    "SELECT partner_id, owner_share_basis_points FROM transaction_partnerships WHERE transaction_id=?", [TX_ID]
  );
  assert.equal(stored?.amount_kurus, 2_000_000);
  assert.equal(stored?.category, "Gübre");
  assert.equal(link?.partner_id, PARTNER_ID);
  assert.equal(link?.owner_share_basis_points, 5_000);
  db.close();
});

test("ortaklık kaldırılırken finans kaydı korunur", async () => {
  const { db } = await setup();
  const corrections = new LocalTransactionCorrections(db);
  const current = await corrections.getActiveTransaction({ farmId: FARM_ID, transactionId: TX_ID });
  assert.ok(current);

  assert.equal(await corrections.updateTransaction({
    farmId: FARM_ID,
    transaction: current,
    partnership: null,
    nowIso: LATER
  }), true);

  assert.equal(
    (await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM transaction_partnerships WHERE transaction_id=?", [TX_ID]))?.count,
    0
  );
  assert.equal(
    (await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM transactions WHERE id=?", [TX_ID]))?.count,
    1
  );
  db.close();
});
