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

function buildProfile(id = "profile-0001") {
  return createFarmerProfile({
    id,
    name: "Mehmet Kaya",
    province: "Diyarbakır",
    district: "Bismil",
    village: "Örnek",
    totalAreaSquareMeters: squareMetersFromUserInput("100", "decare"),
    cropCodes: ["cotton", "corn"]
  });
}

const NOW = "2026-09-06T12:00:00.000Z";
const LATER = "2026-09-06T12:30:00.000Z";

test("onboarding tek transaction ile profil + çiftlik + ürünleri kaydeder", async () => {
  const db = new NodeSqliteAdapter();
  const repo = new LocalFarmRepository(db);
  await repo.saveInitialFarm({ profile: buildProfile(), farmId: "farm-0000001", farmName: "Benim Tarlam", nowIso: NOW });
  assert.equal(await repo.hasCompletedOnboarding(), true);
  const crops = await db.all<{ crop_code: string }>("SELECT crop_code FROM farm_crops ORDER BY crop_code");
  assert.deepEqual(crops.map((row) => row.crop_code), ["corn", "cotton"]);
  const columns = await db.all<{ name: string }>("PRAGMA table_info(farmer_profiles)");
  assert.equal(columns.some((column) => column.name === "phone"), false);
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

test("tamamlanmış onboarding ikinci aktif çiftlik oluşturamaz", async () => {
  const db = new NodeSqliteAdapter();
  const repo = new LocalFarmRepository(db);
  await repo.saveInitialFarm({ profile: buildProfile(), farmId: "farm-0000001", farmName: "Benim Tarlam", nowIso: NOW });

  await assert.rejects(
    () => repo.saveInitialFarm({ profile: buildProfile("profile-0002"), farmId: "farm-0000002", farmName: "İkinci Tarla", nowIso: LATER }),
    /zaten tamamlanmış/
  );

  const farms = await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM farms WHERE deleted_at IS NULL");
  const profiles = await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM farmer_profiles WHERE deleted_at IS NULL");
  assert.equal(farms?.count, 1);
  assert.equal(profiles?.count, 1);
  db.close();
});

test("kullanıcı kaydı olmayan yarım onboarding güvenli soft-repair edilir", async () => {
  const db = new NodeSqliteAdapter();
  const repo = new LocalFarmRepository(db);
  await db.run(
    `INSERT INTO farmer_profiles
      (id,name,province,district,village,total_area_square_meters,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["profile-old-01", "Eski Profil", "Diyarbakır", "Bismil", "Örnek", 100000, NOW, NOW]
  );

  await repo.saveInitialFarm({
    profile: buildProfile("profile-0002"),
    farmId: "farm-0000002",
    farmName: "Benim Tarlam",
    nowIso: LATER
  });

  const oldProfile = await db.first<{ deleted_at: string | null; sync_state: string }>(
    "SELECT deleted_at, sync_state FROM farmer_profiles WHERE id = ?",
    ["profile-old-01"]
  );
  assert.equal(oldProfile?.deleted_at, LATER);
  assert.equal(oldProfile?.sync_state, "pending");
  assert.equal(await repo.hasCompletedOnboarding(), true);
  db.close();
});

test("yarım onboarding altında aktif parcel varsa otomatik repair veri saklamaz", async () => {
  const db = new NodeSqliteAdapter();
  const repo = new LocalFarmRepository(db);
  await db.run(
    `INSERT INTO farmer_profiles
      (id,name,province,district,village,total_area_square_meters,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["profile-old-01", "Eski Profil", "Diyarbakır", "Bismil", "Örnek", 100000, NOW, NOW]
  );
  await db.run(
    `INSERT INTO farms (id,owner_local_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    ["farm-old-0001", "profile-old-01", "Eski Tarla", NOW, NOW]
  );
  await db.run(
    `INSERT INTO farm_crops (farm_id,crop_code,created_at,deleted_at)
     VALUES (?,?,?,?)`,
    ["farm-old-0001", "cotton", NOW, NOW]
  );
  await db.run(
    `INSERT INTO parcels
      (id,farm_id,name,area_square_meters,crop_code,season_year,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["parcel-old-01", "farm-old-0001", "Alt Tarla", 1000, "cotton", 2026, NOW, NOW]
  );

  await assert.rejects(
    () => repo.saveInitialFarm({ profile: buildProfile("profile-0002"), farmId: "farm-0000002", farmName: "Yeni Tarla", nowIso: LATER }),
    /kayıtlı veri bulundu/
  );

  const oldProfile = await db.first<{ deleted_at: string | null }>(
    "SELECT deleted_at FROM farmer_profiles WHERE id = ?",
    ["profile-old-01"]
  );
  const parcel = await db.first<{ deleted_at: string | null }>(
    "SELECT deleted_at FROM parcels WHERE id = ?",
    ["parcel-old-01"]
  );
  assert.equal(oldProfile?.deleted_at, null);
  assert.equal(parcel?.deleted_at, null);
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

test("soft-delete edilmiş çiftliğe yeni finans kaydı yazılamaz", async () => {
  const db = new NodeSqliteAdapter();
  const repo = new LocalFarmRepository(db);
  await repo.saveInitialFarm({ profile: buildProfile(), farmId: "farm-0000001", farmName: "Benim Tarlam", nowIso: NOW });
  await db.run(
    "UPDATE farms SET deleted_at = ?, updated_at = ?, sync_state = 'pending' WHERE id = ?",
    [LATER, LATER, "farm-0000001"]
  );

  const tx = createFarmTransaction({
    id: "txn-after-delete", kind: "expense", amountKurus: 10_000, occurredOn: "2026-09-06", category: "Mazot"
  });
  await assert.rejects(
    () => repo.addTransaction({ farmId: "farm-0000001", transaction: tx, nowIso: LATER }),
    /aktif değil/
  );
  const count = await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM transactions");
  assert.equal(count?.count, 0);
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
