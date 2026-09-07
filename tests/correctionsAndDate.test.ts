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
import { dateInputFromIso, isoDateFromTurkishInput } from "../src/mobile/date";
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

const FARM_ID = "farm-undo-0001";
const NOW = "2026-09-06T12:00:00.000Z";
const LATER = "2026-09-06T12:30:00.000Z";

function profile() {
  return createFarmerProfile({
    id: "profile-undo-0001",
    name: "Mehmet Kaya",
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

test("silinen kayıt geri alınır ve kâr zarar yeniden hesaba katılır", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  const corrections = new LocalTransactionCorrections(db);
  const transaction = createFarmTransaction({
    id: "txn-undo-0001",
    kind: "income",
    amountKurus: 125_000,
    occurredOn: "2026-09-06",
    category: "Ürün satışı",
    cropCode: "cotton"
  });

  await repository.addTransaction({ farmId: FARM_ID, transaction, nowIso: NOW });
  assert.equal(await repository.softDeleteTransaction({ farmId: FARM_ID, transactionId: transaction.id, nowIso: LATER }), true);
  assert.equal((await repository.listTransactions(FARM_ID)).length, 0);
  assert.equal((await repository.profitLoss(FARM_ID)).income, 0);

  assert.equal(await corrections.restoreTransaction({ farmId: FARM_ID, transactionId: transaction.id, nowIso: LATER }), true);
  assert.equal((await repository.listTransactions(FARM_ID)).length, 1);
  assert.equal((await repository.profitLoss(FARM_ID)).income, 125_000);
  db.close();
});

test("aktif kayıt geri alınmış gibi ikinci kez açılamaz", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  const corrections = new LocalTransactionCorrections(db);
  const transaction = createFarmTransaction({
    id: "txn-undo-0002",
    kind: "expense",
    amountKurus: 50_000,
    occurredOn: "2026-09-06",
    category: "Mazot",
    cropCode: "cotton"
  });
  await repository.addTransaction({ farmId: FARM_ID, transaction, nowIso: NOW });
  assert.equal(await corrections.restoreTransaction({ farmId: FARM_ID, transactionId: transaction.id, nowIso: LATER }), false);
  db.close();
});

test("ürünü pasif olmuş silinen kayıt geri alınmaz", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  const corrections = new LocalTransactionCorrections(db);
  const transaction = createFarmTransaction({
    id: "txn-undo-0003",
    kind: "expense",
    amountKurus: 75_000,
    occurredOn: "2026-09-06",
    category: "İlaç",
    cropCode: "cotton"
  });

  await repository.addTransaction({ farmId: FARM_ID, transaction, nowIso: NOW });
  await repository.softDeleteTransaction({ farmId: FARM_ID, transactionId: transaction.id, nowIso: LATER });
  await db.run(
    "UPDATE farm_crops SET deleted_at = ?, sync_state = 'pending' WHERE farm_id = ? AND crop_code = ?",
    [LATER, FARM_ID, "cotton"]
  );

  await assert.rejects(
    () => corrections.restoreTransaction({ farmId: FARM_ID, transactionId: transaction.id, nowIso: LATER }),
    /artık çiftliğinde kayıtlı değil/
  );
  db.close();
});

test("genel kayıt ürün seçmeden güvenli biçimde kaydedilebilir", async () => {
  const db = new NodeSqliteAdapter();
  const repository = await createFarm(db);
  const transaction = createFarmTransaction({
    id: "txn-general-0001",
    kind: "expense",
    amountKurus: 90_000,
    occurredOn: "2026-09-06",
    category: "Mazot"
  });
  await repository.addTransaction({ farmId: FARM_ID, transaction, nowIso: NOW });
  const rows = await repository.listTransactions(FARM_ID);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.cropCode, undefined);
  db.close();
});

test("Türkçe tarih girişi gerçek takvim tarihi olarak doğrulanır", () => {
  assert.equal(isoDateFromTurkishInput("6.9.2026"), "2026-09-06");
  assert.equal(isoDateFromTurkishInput("06/09/2026"), "2026-09-06");
  assert.equal(dateInputFromIso("2026-09-06"), "06.09.2026");
  assert.throws(() => isoDateFromTurkishInput("31.02.2026"), /Tarih geçerli değil/);
  assert.throws(() => isoDateFromTurkishInput("2026-09-06"), /GG.AA.YYYY/);
});
