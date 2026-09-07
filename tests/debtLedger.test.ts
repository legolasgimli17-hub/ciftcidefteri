declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import { LocalDebtRepository } from "../src/application/localDebtRepository";
import { LocalFarmRepository } from "../src/application/localFarmRepository";
import { createDebtInstallment, createDebtPayment, createFarmDebt } from "../src/domain/debt";
import { squareMetersFromUserInput } from "../src/domain/landArea";
import { createFarmerProfile } from "../src/domain/profile";
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

const FARM_ID = "farm-debt-0001";
const DEBT_ID = "debt-bank-0001";
const NOW = "2026-09-07T18:00:00.000Z";
const LATER = "2026-09-08T18:00:00.000Z";

async function setup(): Promise<{ db: TestDatabase; farm: LocalFarmRepository; debts: LocalDebtRepository }> {
  const db = new TestDatabase();
  await migrateDatabase(db);
  const farm = new LocalFarmRepository(db);
  await farm.saveInitialFarm({
    profile: createFarmerProfile({
      id: "profile-debt-0001",
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
  return { db, farm, debts: new LocalDebtRepository(db) };
}

function bankDebt() {
  return createFarmDebt({
    id: DEBT_ID,
    sourceKind: "bank_cash",
    creditorName: "Ziraat Bankası",
    totalKurus: 1_000_000,
    openedOn: "2026-09-07"
  });
}

function installments() {
  return [
    createDebtInstallment({ id: "inst-debt-0001", dueOn: "2026-10-01", amountKurus: 400_000 }),
    createDebtInstallment({ id: "inst-debt-0002", dueOn: "2026-11-01", amountKurus: 600_000 })
  ] as const;
}

test("ayni borç ne alındığını ister; nakdi borç mal açıklaması kabul etmez", () => {
  assert.throws(
    () => createFarmDebt({
      id: "debt-kind-0001",
      sourceKind: "coop_in_kind",
      creditorName: "Tarım Kredi",
      totalKurus: 500_000,
      openedOn: "2026-09-07"
    }),
    /ne aldığını/
  );

  assert.throws(
    () => createFarmDebt({
      id: "debt-kind-0002",
      sourceKind: "bank_cash",
      creditorName: "Banka",
      totalKurus: 500_000,
      openedOn: "2026-09-07",
      inKindDescription: "Gübre"
    }),
    /yalnız ayni borçta/
  );
});

test("borç bakiyesi toplam eksi ödemeden türetilir ve sıradaki taksite ilerler", async () => {
  const { db, debts } = await setup();
  await debts.addDebt({ farmId: FARM_ID, debt: bankDebt(), installments: installments(), nowIso: NOW });

  const before = await debts.listBalances(FARM_ID);
  assert.equal(before.length, 1);
  assert.equal(before[0]?.paidKurus, 0);
  assert.equal(before[0]?.remainingKurus, 1_000_000);
  assert.equal(before[0]?.nextDueOn, "2026-10-01");
  assert.equal(before[0]?.nextDueAmountKurus, 400_000);

  await debts.addPayment({
    farmId: FARM_ID,
    debtId: DEBT_ID,
    payment: createDebtPayment({ id: "debtpay-000001", amountKurus: 450_000, occurredOn: "2026-09-08" }),
    nowIso: LATER
  });

  const after = await debts.listBalances(FARM_ID);
  assert.equal(after[0]?.paidKurus, 450_000);
  assert.equal(after[0]?.remainingKurus, 550_000);
  assert.equal(after[0]?.nextDueOn, "2026-11-01");
  assert.equal(after[0]?.nextDueAmountKurus, 550_000);
  db.close();
});

test("fazla ödeme reddedilir ve bakiye değişmez", async () => {
  const { db, debts } = await setup();
  await debts.addDebt({ farmId: FARM_ID, debt: bankDebt(), installments: installments(), nowIso: NOW });

  await assert.rejects(
    () => debts.addPayment({
      farmId: FARM_ID,
      debtId: DEBT_ID,
      payment: createDebtPayment({ id: "debtpay-000002", amountKurus: 1_000_001, occurredOn: "2026-09-08" }),
      nowIso: LATER
    }),
    /kalan borçtan büyük/
  );

  assert.equal((await debts.listBalances(FARM_ID))[0]?.remainingKurus, 1_000_000);
  assert.equal((await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM debt_payments"))?.count, 0);
  db.close();
});

test("taksit toplamı borca bir kuruş bile uymuyorsa borç kaydı oluşmaz", async () => {
  const { db, debts } = await setup();
  await assert.rejects(
    () => debts.addDebt({
      farmId: FARM_ID,
      debt: bankDebt(),
      installments: [
        createDebtInstallment({ id: "inst-wrong-0001", dueOn: "2026-10-01", amountKurus: 999_999 })
      ],
      nowIso: NOW
    }),
    /toplam borçla aynı/
  );
  assert.equal((await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM debts"))?.count, 0);
  assert.equal((await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM debt_installments"))?.count, 0);
  db.close();
});

test("borç almak ve anapara ödemek gelir-gider özetini değiştirmez", async () => {
  const { db, farm, debts } = await setup();
  const before = await farm.profitLoss(FARM_ID);
  await debts.addDebt({ farmId: FARM_ID, debt: bankDebt(), installments: installments(), nowIso: NOW });
  await debts.addPayment({
    farmId: FARM_ID,
    debtId: DEBT_ID,
    payment: createDebtPayment({ id: "debtpay-000003", amountKurus: 100_000, occurredOn: "2026-09-08" }),
    nowIso: LATER
  });
  const after = await farm.profitLoss(FARM_ID);
  assert.deepEqual(after, before);
  db.close();
});

test("persisted ödemeler toplam borcu aşarsa yanlış bakiye gösterilmez", async () => {
  const { db, debts } = await setup();
  await debts.addDebt({ farmId: FARM_ID, debt: bankDebt(), installments: installments(), nowIso: NOW });

  await db.run(
    `INSERT INTO debt_payments
      (id,farm_id,debt_id,amount_kurus,occurred_on,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    ["debtpay-bad-0001", FARM_ID, DEBT_ID, 700_000, "2026-09-08", LATER, LATER]
  );
  await db.run(
    `INSERT INTO debt_payments
      (id,farm_id,debt_id,amount_kurus,occurred_on,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    ["debtpay-bad-0002", FARM_ID, DEBT_ID, 400_001, "2026-09-09", LATER, LATER]
  );

  await assert.rejects(() => debts.listBalances(FARM_ID), /toplam borcu aşıyor/);
  db.close();
});

test("silinmiş borca bağlı aktif ödeme veya taksit sessizce gizlenmez", async () => {
  const { db, debts } = await setup();
  await debts.addDebt({ farmId: FARM_ID, debt: bankDebt(), installments: installments(), nowIso: NOW });
  await db.run("UPDATE debts SET deleted_at = ? WHERE farm_id = ? AND id = ?", [LATER, FARM_ID, DEBT_ID]);
  await assert.rejects(() => debts.listBalances(FARM_ID), /eşleşmeyen kayıt/);
  db.close();
});
