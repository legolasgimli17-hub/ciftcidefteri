declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

import { loadCropFinanceReport } from "../src/application/cropFinanceReport";
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

const FARM_ID = "farm-report-001";
const NOW = "2026-09-07T00:00:00.000Z";
const LATER = "2026-09-07T00:30:00.000Z";

function profile() {
  return createFarmerProfile({
    id: "profile-report-001",
    name: "Mehmet Kaya",
    phone: "05321234567",
    province: "Diyarbakır",
    district: "Bismil",
    village: "Örnek",
    totalAreaSquareMeters: squareMetersFromUserInput("100", "decare"),
    cropCodes: ["cotton", "corn"]
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

async function add(
  repository: LocalFarmRepository,
  input: {
    id: string;
    kind: "income" | "expense";
    amountKurus: number;
    cropCode?: "cotton" | "corn";
  }
): Promise<void> {
  await repository.addTransaction({
    farmId: FARM_ID,
    nowIso: NOW,
    transaction: createFarmTransaction({
      id: input.id,
      kind: input.kind,
      amountKurus: input.amountKurus,
      occurredOn: "2026-09-07",
      category: input.kind === "income" ? "Ürün satışı" : "Masraf",
      ...(input.cropCode === undefined ? {} : { cropCode: input.cropCode })
    })
  });
}

test("ürün özeti seçili ürünleri ve genel kayıtları doğru toplar", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  await add(repository, { id: "txn-cotton-income", kind: "income", amountKurus: 100_000, cropCode: "cotton" });
  await add(repository, { id: "txn-cotton-cost", kind: "expense", amountKurus: 40_000, cropCode: "cotton" });
  await add(repository, { id: "txn-corn-cost-001", kind: "expense", amountKurus: 20_000, cropCode: "corn" });
  await add(repository, { id: "txn-general-cost", kind: "expense", amountKurus: 10_000 });

  const report = await loadCropFinanceReport(db);
  if (report === null) throw new Error("Test çiftliği için ürün özeti oluşmadı.");

  assert.deepEqual(report.overall, {
    incomeKurus: 100_000,
    expenseKurus: 70_000,
    netKurus: 30_000
  });
  assert.deepEqual(report.rows.map((row) => [row.label, row.incomeKurus, row.expenseKurus, row.netKurus]), [
    ["Pamuk", 100_000, 40_000, 60_000],
    ["Mısır", 0, 20_000, -20_000],
    ["Genel kayıtlar", 0, 10_000, -10_000]
  ]);
  db.close();
});

test("işlem görmemiş seçili ürün sıfır değerlerle görünür ve silinen kayıt hesaba katılmaz", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  await add(repository, { id: "txn-cotton-temp01", kind: "expense", amountKurus: 25_000, cropCode: "cotton" });
  assert.equal(await repository.softDeleteTransaction({
    farmId: FARM_ID,
    transactionId: "txn-cotton-temp01",
    nowIso: LATER
  }), true);

  const report = await loadCropFinanceReport(db);
  if (report === null) throw new Error("Test çiftliği için ürün özeti oluşmadı.");

  assert.deepEqual(report.overall, { incomeKurus: 0, expenseKurus: 0, netKurus: 0 });
  assert.deepEqual(report.rows.map((row) => [row.label, row.netKurus]), [
    ["Pamuk", 0],
    ["Mısır", 0]
  ]);
  db.close();
});

test("artık seçili olmayan ürünün aktif geçmişi sessizce kaybolmaz", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  await add(repository, { id: "txn-cotton-old001", kind: "income", amountKurus: 55_000, cropCode: "cotton" });
  await db.run(
    "UPDATE farm_crops SET deleted_at = ?, sync_state = 'pending' WHERE farm_id = ? AND crop_code = 'cotton'",
    [LATER, FARM_ID]
  );

  const report = await loadCropFinanceReport(db);
  if (report === null) throw new Error("Test çiftliği için ürün özeti oluşmadı.");

  assert.deepEqual(report.rows.map((row) => [row.label, row.isHistorical, row.netKurus]), [
    ["Mısır", false, 0],
    ["Pamuk · eski kayıtlar", true, 55_000]
  ]);
  assert.equal(report.overall.netKurus, 55_000);
  db.close();
});

test("bozuk persisted finans satırı ürün özetini fail-closed durdurur", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  await add(repository, { id: "txn-corrupt-report", kind: "income", amountKurus: 50_000, cropCode: "cotton" });

  await db.exec("PRAGMA ignore_check_constraints = ON;");
  await db.run("UPDATE transactions SET amount_kurus = 0 WHERE id = ?", ["txn-corrupt-report"]);

  await assert.rejects(() => loadCropFinanceReport(db), /geçersiz kayıt/);
  db.close();
});
