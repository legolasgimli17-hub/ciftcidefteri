declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import { LocalDebtDetailsRepository } from "../src/application/localDebtDetailsRepository";
import { LocalDebtRepository } from "../src/application/localDebtRepository";
import { LocalFarmRepository } from "../src/application/localFarmRepository";
import { createDebtInstallment, createDebtPayment, createFarmDebt } from "../src/domain/debt";
import { squareMetersFromUserInput } from "../src/domain/landArea";
import { createFarmerProfile } from "../src/domain/profile";
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

const FARM_ID = "farm-detail-0001";
const DEBT_ID = "debt-detail-0001";
const NOW = "2026-09-07T18:30:00.000Z";
const LATER = "2026-09-08T18:30:00.000Z";
const LATEST = "2026-09-09T18:30:00.000Z";

async function setup() {
  const db = new TestDatabase();
  await migrateDatabase(db);
  await new LocalFarmRepository(db).saveInitialFarm({
    profile: createFarmerProfile({
      id: "profile-detail-0001",
      name: "Mehmet Kaya",
      province: "Diyarbakır",
      district: "Bismil",
      village: "Örnek",
      totalAreaSquareMeters: squareMetersFromUserInput("80", "decare"),
      cropCodes: ["wheat"]
    }),
    farmId: FARM_ID,
    farmName: "Benim Tarlam",
    nowIso: NOW
  });
  const debts = new LocalDebtRepository(db);
  await debts.addDebt({
    farmId: FARM_ID,
    debt: createFarmDebt({
      id: DEBT_ID,
      sourceKind: "coop_in_kind",
      creditorName: "Tarım Kredi",
      totalKurus: 900_000,
      openedOn: "2026-09-07",
      inKindDescription: "Gübre"
    }),
    installments: [
      createDebtInstallment({ id: "inst-detail-0001", dueOn: "2026-10-01", amountKurus: 400_000 }),
      createDebtInstallment({ id: "inst-detail-0002", dueOn: "2026-11-01", amountKurus: 500_000 })
    ],
    nowIso: NOW
  });
  return { db, debts, details: new LocalDebtDetailsRepository(db) };
}

test("borç detayı ödeme planını ve gerçek ödeme hareketlerini gösterir", async () => {
  const { db, debts, details } = await setup();
  await debts.addPayment({
    farmId: FARM_ID,
    debtId: DEBT_ID,
    payment: createDebtPayment({ id: "debtpay-detail-0001", amountKurus: 100_000, occurredOn: "2026-09-08", note: "İlk ödeme" }),
    nowIso: LATER
  });
  await debts.addPayment({
    farmId: FARM_ID,
    debtId: DEBT_ID,
    payment: createDebtPayment({ id: "debtpay-detail-0002", amountKurus: 150_000, occurredOn: "2026-09-09" }),
    nowIso: LATEST
  });

  const detail = await details.load(FARM_ID, DEBT_ID);
  assert.equal(detail.balance.paidKurus, 250_000);
  assert.equal(detail.balance.remainingKurus, 650_000);
  assert.equal(detail.installments.length, 2);
  assert.equal(detail.installments[0]?.dueOn, "2026-10-01");
  assert.equal(detail.payments.length, 2);
  assert.equal(detail.payments[0]?.id, "debtpay-detail-0002");
  assert.equal(detail.payments[1]?.note, "İlk ödeme");
  db.close();
});

test("yanlış ödeme geri alındığında bakiye kaynak kayıttan yeniden hesaplanır", async () => {
  const { db, debts, details } = await setup();
  await debts.addPayment({
    farmId: FARM_ID,
    debtId: DEBT_ID,
    payment: createDebtPayment({ id: "debtpay-detail-0003", amountKurus: 300_000, occurredOn: "2026-09-08" }),
    nowIso: LATER
  });

  assert.equal((await details.load(FARM_ID, DEBT_ID)).balance.remainingKurus, 600_000);
  await details.reversePayment({
    farmId: FARM_ID,
    debtId: DEBT_ID,
    paymentId: "debtpay-detail-0003",
    nowIso: LATEST
  });

  const after = await details.load(FARM_ID, DEBT_ID);
  assert.equal(after.balance.paidKurus, 0);
  assert.equal(after.balance.remainingKurus, 900_000);
  assert.equal(after.payments.length, 0);
  assert.equal(
    (await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM debt_payments WHERE deleted_at IS NOT NULL"))?.count,
    1
  );
  db.close();
});

test("aktif ödeme varken borç silinmez; ödemeler geri alındıktan sonra atomik silinir", async () => {
  const { db, debts, details } = await setup();
  await debts.addPayment({
    farmId: FARM_ID,
    debtId: DEBT_ID,
    payment: createDebtPayment({ id: "debtpay-detail-0004", amountKurus: 200_000, occurredOn: "2026-09-08" }),
    nowIso: LATER
  });

  await assert.rejects(
    () => details.deleteDebtWithoutPayments({ farmId: FARM_ID, debtId: DEBT_ID, nowIso: LATEST }),
    /Aktif ödeme/
  );
  assert.equal((await debts.listBalances(FARM_ID)).length, 1);

  await details.reversePayment({
    farmId: FARM_ID,
    debtId: DEBT_ID,
    paymentId: "debtpay-detail-0004",
    nowIso: LATEST
  });
  await details.deleteDebtWithoutPayments({ farmId: FARM_ID, debtId: DEBT_ID, nowIso: LATEST });

  assert.equal((await debts.listBalances(FARM_ID)).length, 0);
  assert.equal(
    (await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM debt_installments WHERE deleted_at IS NULL"))?.count,
    0
  );
  assert.equal((await db.all("PRAGMA foreign_key_check")).length, 0);
  db.close();
});
