declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import { LocalFarmRepository } from "../src/application/localFarmRepository";
import { LocalPartnershipRepository } from "../src/application/localPartnershipRepository";
import { createFarmPartner } from "../src/domain/partner";
import { createPartnershipSettlement } from "../src/domain/partnershipSettlement";
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

const now = "2026-09-07T15:00:00.000Z";
const farmId = "farm-ledger-0001";
const partnerId = "partner-ledger-01";

async function seedFarm(db: TestDatabase): Promise<void> {
  await migrateDatabase(db);
  await db.run(
    `INSERT INTO farmer_profiles
      (id,name,province,district,village,total_area_square_meters,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["profile-ledger-01", "Mehmet Kaya", "Diyarbakır", "Bismil", "Örnek", 100000, now, now]
  );
  await db.run(
    `INSERT INTO farms (id,owner_local_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    [farmId, "profile-ledger-01", "Benim Çiftliğim", now, now]
  );
  await db.run(
    `INSERT INTO farm_crops (farm_id,crop_code,created_at) VALUES (?,?,?)`,
    [farmId, "cotton", now]
  );
}

async function insertSharedTransaction(db: TestDatabase, input: {
  id: string;
  kind: "income" | "expense";
  amountKurus: number;
  ownerShareBasisPoints: number;
  cashActor: "owner" | "partner";
}): Promise<void> {
  await db.run(
    `INSERT INTO transactions
      (id,farm_id,kind,amount_kurus,occurred_on,category,crop_code,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [input.id, farmId, input.kind, input.amountKurus, "2026-09-07", input.kind === "expense" ? "Gübre" : "Ürün satışı", "cotton", now, now]
  );
  await db.run(
    `INSERT INTO transaction_partnerships
      (transaction_id,farm_id,partner_id,owner_share_basis_points,cash_actor,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    [input.id, farmId, partnerId, input.ownerShareBasisPoints, input.cashActor, now, now]
  );
}

async function addDefaultPartner(db: TestDatabase): Promise<LocalPartnershipRepository> {
  const repo = new LocalPartnershipRepository(db);
  await repo.addPartner({
    farmId,
    partner: createFarmPartner({ id: partnerId, name: "Ahmet Demir" }),
    nowIso: now
  });
  return repo;
}

test("ortak giderini ben ödersem ortağın payı alacağım olarak görünür ve ödeme bakiyeyi azaltır", async () => {
  const db = new TestDatabase();
  await seedFarm(db);
  const repo = await addDefaultPartner(db);
  await insertSharedTransaction(db, {
    id: "txn-shared-exp-01",
    kind: "expense",
    amountKurus: 2_000_000,
    ownerShareBasisPoints: 5000,
    cashActor: "owner"
  });

  let balances = await repo.balances(farmId);
  assert.equal(balances.length, 1);
  assert.equal(balances[0]?.receivableKurus, 1_000_000);
  assert.equal(balances[0]?.payableKurus, 0);
  assert.equal(balances[0]?.netKurus, 1_000_000);

  await repo.addSettlement({
    farmId,
    settlement: createPartnershipSettlement({
      id: "settlement-000001",
      partnerId,
      amountKurus: 600_000,
      occurredOn: "2026-09-08",
      direction: "partner_to_owner",
      note: "Kısmi ödeme"
    }),
    nowIso: "2026-09-08T10:00:00.000Z"
  });

  balances = await repo.balances(farmId);
  assert.equal(balances[0]?.netKurus, 400_000);

  await assert.rejects(
    () => repo.addSettlement({
      farmId,
      settlement: createPartnershipSettlement({
        id: "settlement-000002",
        partnerId,
        amountKurus: 400_001,
        occurredOn: "2026-09-09",
        direction: "partner_to_owner"
      }),
      nowIso: "2026-09-09T10:00:00.000Z"
    }),
    /aşıyor/
  );
  db.close();
});

test("ortağın ödediği gider benim borcum olur ve hesap kapatma kâr-zararı değiştirmez", async () => {
  const db = new TestDatabase();
  await seedFarm(db);
  const repo = await addDefaultPartner(db);
  await insertSharedTransaction(db, {
    id: "txn-shared-exp-02",
    kind: "expense",
    amountKurus: 1_000_000,
    ownerShareBasisPoints: 7000,
    cashActor: "partner"
  });
  await db.run(
    `INSERT INTO transactions
      (id,farm_id,kind,amount_kurus,occurred_on,category,crop_code,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    ["txn-solo-income-1", farmId, "income", 5_000_000, "2026-09-07", "Ürün satışı", "cotton", now, now]
  );

  const farmRepo = new LocalFarmRepository(db);
  const before = await farmRepo.profitLoss(farmId);
  assert.equal(before.net, 4_000_000);

  let balances = await repo.balances(farmId);
  assert.equal(balances[0]?.payableKurus, 700_000);
  assert.equal(balances[0]?.netKurus, -700_000);

  await repo.addSettlement({
    farmId,
    settlement: createPartnershipSettlement({
      id: "settlement-000003",
      partnerId,
      amountKurus: 700_000,
      occurredOn: "2026-09-08",
      direction: "owner_to_partner"
    }),
    nowIso: "2026-09-08T10:00:00.000Z"
  });

  balances = await repo.balances(farmId);
  assert.equal(balances[0]?.netKurus, 0);
  const after = await farmRepo.profitLoss(farmId);
  assert.equal(after.net, before.net);
  assert.equal(after.income, before.income);
  assert.equal(after.expense, before.expense);
  db.close();
});

test("aynı isimli aktif ortak ikinci kez oluşturulamaz", async () => {
  const db = new TestDatabase();
  await seedFarm(db);
  const repo = await addDefaultPartner(db);
  await assert.rejects(
    () => repo.addPartner({
      farmId,
      partner: createFarmPartner({ id: "partner-ledger-02", name: "ahmet   DEMİR" }),
      nowIso: now
    }),
    /zaten var/
  );
  db.close();
});
