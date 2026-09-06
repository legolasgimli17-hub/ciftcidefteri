declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

import { loadAppSnapshot } from "../src/application/appSnapshot";
import { LocalFarmRepository } from "../src/application/localFarmRepository";
import { squareMetersFromUserInput } from "../src/domain/landArea";
import { createFarmerProfile } from "../src/domain/profile";
import { createProfitLossSummary } from "../src/domain/profitLoss";
import { createFarmTransaction } from "../src/domain/transaction";
import { type SqlDatabase, type SqlExecutor, type SqlPrimitive, type SqlRunResult } from "../src/storage/sql";

class NodeSqliteAdapter implements SqlDatabase {
  private readonly db = new DatabaseSync(":memory:");

  public constructor() {
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec(fs.readFileSync(path.resolve("src/storage/schema.sql"), "utf8"));
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

const FARM_ID = "farm-0000001";
const NOW = "2026-09-06T12:00:00.000Z";
const LATER = "2026-09-06T12:30:00.000Z";

function profile() {
  return createFarmerProfile({
    id: "profile-0001",
    name: "Mehmet Kaya",
    phone: "05321234567",
    province: "Diyarbakır",
    district: "Bismil",
    village: "Örnek",
    totalAreaSquareMeters: squareMetersFromUserInput("100", "decare"),
    cropCodes: ["cotton"]
  });
}

async function createFarm(db: NodeSqliteAdapter): Promise<LocalFarmRepository> {
  const repository = new LocalFarmRepository(db);
  await repository.saveInitialFarm({
    profile: profile(),
    farmId: FARM_ID,
    farmName: "Benim Tarlam",
    nowIso: NOW
  });
  return repository;
}

test("ana ekran yalnız son 4 kaydı taşır ama özet tüm aktif geçmişi hesaplar", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);

  for (let index = 1; index <= 8; index += 1) {
    const kind = index % 2 === 1 ? "income" : "expense";
    await repository.addTransaction({
      farmId: FARM_ID,
      nowIso: NOW,
      transaction: createFarmTransaction({
        id: `txn-0000000${index}`,
        kind,
        amountKurus: index * 10_000,
        occurredOn: `2026-09-0${index}`,
        category: kind === "income" ? "Ürün satışı" : "Mazot",
        cropCode: "cotton",
        isTaxExemptSupport: index === 7
      })
    });
  }

  assert.equal(
    await repository.softDeleteTransaction({
      farmId: FARM_ID,
      transactionId: "txn-00000002",
      nowIso: LATER
    }),
    true
  );

  const snapshot = await loadAppSnapshot(db);
  if (snapshot === null) {
    throw new Error("Test çiftliği için ana ekran snapshot'ı oluşmadı.");
  }
  assert.deepEqual(
    snapshot.recentTransactions.map((item) => item.id),
    ["txn-00000008", "txn-00000007", "txn-00000006", "txn-00000005"]
  );
  assert.equal(snapshot.summary.income, 160_000);
  assert.equal(snapshot.summary.expense, 180_000);
  assert.equal(snapshot.summary.net, -20_000);
  assert.equal(snapshot.summary.taxExemptSupportIncome, 70_000);
  db.close();
});

test("son kayıt limiti sınırlı ve geçerli tam sayı olmalı", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  await assert.rejects(() => repository.listRecentTransactions(FARM_ID, 0), /1-50/);
  await assert.rejects(() => repository.listRecentTransactions(FARM_ID, 51), /1-50/);
  await assert.rejects(() => repository.listRecentTransactions(FARM_ID, 1.5), /1-50/);
  db.close();
});

test("SQL aggregate bozuk persisted booleanı sessizce özetlemez", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  const transaction = createFarmTransaction({
    id: "txn-corrupt-001",
    kind: "income",
    amountKurus: 50_000,
    occurredOn: "2026-09-06",
    category: "Ürün satışı",
    cropCode: "cotton"
  });
  await repository.addTransaction({ farmId: FARM_ID, transaction, nowIso: NOW });

  await db.exec("PRAGMA ignore_check_constraints = ON;");
  await db.run(
    "UPDATE transactions SET is_tax_exempt_support = 2 WHERE id = ?",
    [transaction.id]
  );

  await assert.rejects(() => repository.profitLoss(FARM_ID), /geçersiz kayıt/);
  db.close();
});

test("kâr zarar toplamı destek gelirinin toplam geliri aşmasına izin vermez", () => {
  assert.throws(
    () => createProfitLossSummary({
      incomeKurus: 10_000,
      expenseKurus: 0,
      taxExemptSupportIncomeKurus: 20_000
    }),
    /toplam gelirden büyük olamaz/
  );
});
