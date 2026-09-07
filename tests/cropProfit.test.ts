declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

import { loadCropProfitSummaries } from "../src/application/cropProfit";
import { LocalFarmRepository } from "../src/application/localFarmRepository";
import { squareMetersFromUserInput } from "../src/domain/landArea";
import { createFarmerProfile } from "../src/domain/profile";
import { createFarmTransaction } from "../src/domain/transaction";
import { type SqlDatabase, type SqlExecutor, type SqlPrimitive, type SqlRunResult } from "../src/storage/sql";

class NodeSqliteAdapter implements SqlDatabase {
  private readonly db = new DatabaseSync(":memory:");

  public constructor() {
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec(fs.readFileSync(path.resolve("src/storage/schema.sql"), "utf8"));
    this.db.exec(fs.readFileSync(path.resolve("src/storage/migrations/0002_transaction_history_index.sql"), "utf8"));
    this.db.exec(fs.readFileSync(path.resolve("src/storage/migrations/0003_remove_profile_phone.sql"), "utf8"));
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

const FARM_ID = "farm-crop-0001";
const NOW = "2026-09-07T13:40:00.000Z";

async function createFarm(db: NodeSqliteAdapter): Promise<LocalFarmRepository> {
  const repository = new LocalFarmRepository(db);
  await repository.saveInitialFarm({
    farmId: FARM_ID,
    farmName: "Benim Tarlam",
    nowIso: NOW,
    profile: createFarmerProfile({
      id: "profile-crop-0001",
      name: "Mehmet Kaya",
      province: "Diyarbakır",
      district: "Bismil",
      village: "Örnek",
      totalAreaSquareMeters: squareMetersFromUserInput("100", "decare"),
      cropCodes: ["cotton", "corn"]
    })
  });
  return repository;
}

test("ürün özeti her ürünü ayrı toplar ve Genel kaydı ürüne yazmaz", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);

  const records = [
    createFarmTransaction({
      id: "txn-cotton-income",
      kind: "income",
      amountKurus: 300_000,
      occurredOn: "2026-09-01",
      category: "Ürün satışı",
      cropCode: "cotton"
    }),
    createFarmTransaction({
      id: "txn-cotton-expense",
      kind: "expense",
      amountKurus: 120_000,
      occurredOn: "2026-09-02",
      category: "Gübre",
      cropCode: "cotton"
    }),
    createFarmTransaction({
      id: "txn-corn-expense-1",
      kind: "expense",
      amountKurus: 80_000,
      occurredOn: "2026-09-03",
      category: "Sulama",
      cropCode: "corn"
    }),
    createFarmTransaction({
      id: "txn-general-income",
      kind: "income",
      amountKurus: 900_000,
      occurredOn: "2026-09-04",
      category: "Diğer gelir"
    })
  ];

  for (const transaction of records) {
    await repository.addTransaction({ farmId: FARM_ID, transaction, nowIso: NOW });
  }

  const summaries = await loadCropProfitSummaries(db, FARM_ID);
  assert.equal(summaries.length, 2);

  const cotton = summaries.find((item) => item.cropCode === "cotton");
  const corn = summaries.find((item) => item.cropCode === "corn");
  assert.ok(cotton);
  assert.ok(corn);
  assert.equal(cotton.cropLabel, "Pamuk");
  assert.equal(cotton.summary.income, 300_000);
  assert.equal(cotton.summary.expense, 120_000);
  assert.equal(cotton.summary.net, 180_000);
  assert.equal(corn.cropLabel, "Mısır");
  assert.equal(corn.summary.income, 0);
  assert.equal(corn.summary.expense, 80_000);
  assert.equal(corn.summary.net, -80_000);
  db.close();
});

test("ürün özeti aktif ürüne eşleşmeyen finans kaydını sessizce gizlemez", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  await repository.addTransaction({
    farmId: FARM_ID,
    nowIso: NOW,
    transaction: createFarmTransaction({
      id: "txn-orphan-crop-1",
      kind: "expense",
      amountKurus: 50_000,
      occurredOn: "2026-09-05",
      category: "Mazot",
      cropCode: "corn"
    })
  });

  await db.run(
    "UPDATE farm_crops SET deleted_at = ?, sync_state = 'pending' WHERE farm_id = ? AND crop_code = ?",
    [NOW, FARM_ID, "corn"]
  );

  await assert.rejects(() => loadCropProfitSummaries(db, FARM_ID), /eşleştirilemedi/);
  db.close();
});
