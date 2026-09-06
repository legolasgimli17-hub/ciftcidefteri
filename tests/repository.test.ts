declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

import { LocalFarmRepository } from "../src/application/localFarmRepository";
import { squareMetersFromUserInput } from "../src/domain/landArea";
import { createFarmerProfile } from "../src/domain/profile";
import { createFarmTransaction } from "../src/domain/transaction";
import { type SqlDatabase, type SqlExecutor, type SqlPrimitive, type SqlRunResult } from "../src/storage/sql";

class NodeSqliteAdapter implements SqlDatabase {
  private readonly db = new DatabaseSync(":memory:");

  public constructor() {
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

function buildProfile() {
  return createFarmerProfile({
    id: "profile-0001",
    name: "Mehmet Kaya",
    phone: "05321234567",
    province: "Diyarbakır",
    district: "Bismil",
    village: "Örnek",
    totalAreaSquareMeters: squareMetersFromUserInput("100", "decare"),
    cropCodes: ["cotton", "corn"]
  });
}

const NOW = "2026-09-06T12:00:00.000Z";

test("onboarding tek transaction ile profil + çiftlik + ürünleri kaydeder", async () => {
  const db = new NodeSqliteAdapter();
  const repo = new LocalFarmRepository(db);
  await repo.saveInitialFarm({ profile: buildProfile(), farmId: "farm-0000001", farmName: "Benim Tarlam", nowIso: NOW });
  assert.equal(await repo.hasCompletedOnboarding(), true);
  const crops = await db.all<{ crop_code: string }>("SELECT crop_code FROM farm_crops ORDER BY crop_code");
  assert.deepEqual(crops.map((row) => row.crop_code), ["corn", "cotton"]);
  db.close();
});

test("onboarding ortada bozulursa hiçbir yarım profil bırakmaz", async () => {
  const db = new NodeSqliteAdapter();
  const repo = new LocalFarmRepository(db);
  const badProfile = { ...buildProfile(), cropCodes: ["cotton", "banana"] as any };
  await assert.rejects(() => repo.saveInitialFarm({ profile: badProfile, farmId: "farm-0000001", farmName: "Benim Tarlam", nowIso: NOW }));
  assert.equal(await repo.hasCompletedOnboarding(), false);
  const farms = await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM farms");
  assert.equal(farms?.count, 0);
  db.close();
});

test("gelir/gider kaydı repository üzerinden saklanır ve özetlenir", async () => {
  const db = new NodeSqliteAdapter();
  const repo = new LocalFarmRepository(db);
  await repo.saveInitialFarm({ profile: buildProfile(), farmId: "farm-0000001", farmName: "Benim Tarlam", nowIso: NOW });

  await repo.addTransaction({ farmId: "farm-0000001", nowIso: NOW, transaction: createFarmTransaction({
    id: "txn-income-001", kind: "income", amountKurus: 200_000, occurredOn: "2026-09-06", category: "Ürün satışı", cropCode: "cotton"
  }) });
  await repo.addTransaction({ farmId: "farm-0000001", nowIso: NOW, transaction: createFarmTransaction({
    id: "txn-expense-001", kind: "expense", amountKurus: 50_000, occurredOn: "2026-09-06", category: "Çırçır masrafı", cropCode: "cotton"
  }) });

  const summary = await repo.profitLoss("farm-0000001");
  assert.equal(summary.income, 200_000);
  assert.equal(summary.expense, 50_000);
  assert.equal(summary.net, 150_000);
  db.close();
});

test("soft delete kaydı görünümden kaldırır ama fiziksel olarak silmez", async () => {
  const db = new NodeSqliteAdapter();
  const repo = new LocalFarmRepository(db);
  await repo.saveInitialFarm({ profile: buildProfile(), farmId: "farm-0000001", farmName: "Benim Tarlam", nowIso: NOW });
  const tx = createFarmTransaction({ id: "txn-delete-001", kind: "expense", amountKurus: 10_000, occurredOn: "2026-09-06", category: "Mazot" });
  await repo.addTransaction({ farmId: "farm-0000001", transaction: tx, nowIso: NOW });
  assert.equal(await repo.softDeleteTransaction({ farmId: "farm-0000001", transactionId: tx.id, nowIso: NOW }), true);
  assert.equal((await repo.listTransactions("farm-0000001")).length, 0);
  const row = await db.first<{ deleted_at: string | null; sync_state: string }>("SELECT deleted_at, sync_state FROM transactions WHERE id = ?", [tx.id]);
  assert.equal(row?.deleted_at, NOW);
  assert.equal(row?.sync_state, "pending");
  db.close();
});

test("işlem yalnızca çiftlikte seçili ürüne yazılabilir", async () => {
  const db = new NodeSqliteAdapter();
  const repo = new LocalFarmRepository(db);
  await repo.saveInitialFarm({ profile: buildProfile(), farmId: "farm-0000001", farmName: "Benim Tarlam", nowIso: NOW });
  const invalid = createFarmTransaction({
    id: "txn-invalid-crop", kind: "expense", amountKurus: 10_000, occurredOn: "2026-09-06", category: "Budama işçiliği", cropCode: "hazelnut"
  });
  await assert.rejects(() => repo.addTransaction({ farmId: "farm-0000001", transaction: invalid, nowIso: NOW }), /çiftliğinde kayıtlı değil/);
  const count = await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM transactions");
  assert.equal(count?.count, 0);
  db.close();
});
