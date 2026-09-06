declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

import { LocalFarmRepository } from "../src/application/localFarmRepository";
import { LocalTransactionCorrections } from "../src/application/transactionCorrections";
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

const FARM_ID = "farm-edit-0001";
const NOW = "2026-09-06T12:00:00.000Z";
const LATER = "2026-09-06T13:00:00.000Z";

function profile() {
  return createFarmerProfile({
    id: "profile-edit-0001",
    name: "Ayşe Kaya",
    phone: "05321234567",
    province: "Diyarbakır",
    district: "Bismil",
    village: "Örnek",
    totalAreaSquareMeters: squareMetersFromUserInput("80", "decare"),
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

test("aktif kayıt aynı kimlikle düzenlenir ve özet yeni değeri kullanır", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  const corrections = new LocalTransactionCorrections(db);
  const original = createFarmTransaction({
    id: "txn-edit-0001",
    kind: "expense",
    amountKurus: 100_000,
    occurredOn: "2026-09-05",
    category: "Mazot",
    cropCode: "cotton",
    note: "İlk kayıt"
  });
  await repository.addTransaction({ farmId: FARM_ID, transaction: original, nowIso: NOW });

  const loaded = await corrections.getActiveTransaction({ farmId: FARM_ID, transactionId: original.id });
  assert.equal(loaded?.id, original.id);
  assert.equal(loaded?.amountKurus, 100_000);

  const updated = createFarmTransaction({
    id: original.id,
    kind: "expense",
    amountKurus: 145_000,
    occurredOn: "2026-09-06",
    category: "İşçilik",
    note: "İlk kayıt"
  });
  assert.equal(await corrections.updateTransaction({ farmId: FARM_ID, transaction: updated, nowIso: LATER }), true);

  const rows = await repository.listTransactions(FARM_ID);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, original.id);
  assert.equal(rows[0]?.amountKurus, 145_000);
  assert.equal(rows[0]?.occurredOn, "2026-09-06");
  assert.equal(rows[0]?.category, "İşçilik");
  assert.equal(rows[0]?.cropCode, undefined);
  assert.equal(rows[0]?.note, "İlk kayıt");
  assert.equal((await repository.profitLoss(FARM_ID)).expense, 145_000);
  db.close();
});

test("pasif ürüne kayıt düzenlenemez", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  const corrections = new LocalTransactionCorrections(db);
  const original = createFarmTransaction({
    id: "txn-edit-0002",
    kind: "income",
    amountKurus: 200_000,
    occurredOn: "2026-09-06",
    category: "Ürün satışı",
    cropCode: "cotton"
  });
  await repository.addTransaction({ farmId: FARM_ID, transaction: original, nowIso: NOW });
  await db.run(
    "UPDATE farm_crops SET deleted_at = ?, sync_state = 'pending' WHERE farm_id = ? AND crop_code = ?",
    [LATER, FARM_ID, "corn"]
  );

  const attempted = createFarmTransaction({
    id: original.id,
    kind: "income",
    amountKurus: 200_000,
    occurredOn: "2026-09-06",
    category: "Ürün satışı",
    cropCode: "corn"
  });
  await assert.rejects(
    () => corrections.updateTransaction({ farmId: FARM_ID, transaction: attempted, nowIso: LATER }),
    /artık çiftliğinde kayıtlı değil/
  );
  const unchanged = await corrections.getActiveTransaction({ farmId: FARM_ID, transactionId: original.id });
  assert.equal(unchanged?.cropCode, "cotton");
  db.close();
});

test("silinmiş kayıt düzenlenemez", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  const corrections = new LocalTransactionCorrections(db);
  const original = createFarmTransaction({
    id: "txn-edit-0003",
    kind: "expense",
    amountKurus: 50_000,
    occurredOn: "2026-09-06",
    category: "İlaç",
    cropCode: "cotton"
  });
  await repository.addTransaction({ farmId: FARM_ID, transaction: original, nowIso: NOW });
  await repository.softDeleteTransaction({ farmId: FARM_ID, transactionId: original.id, nowIso: LATER });

  const attempted = createFarmTransaction({
    id: original.id,
    kind: "expense",
    amountKurus: 60_000,
    occurredOn: "2026-09-06",
    category: "İlaç",
    cropCode: "cotton"
  });
  assert.equal(await corrections.updateTransaction({ farmId: FARM_ID, transaction: attempted, nowIso: LATER }), false);
  assert.equal(await corrections.getActiveTransaction({ farmId: FARM_ID, transactionId: original.id }), null);
  db.close();
});
