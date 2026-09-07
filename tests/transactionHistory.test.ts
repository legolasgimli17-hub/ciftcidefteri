declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

import { LocalFarmRepository } from "../src/application/localFarmRepository";
import {
  LocalTransactionHistory,
  type TransactionHistoryCursor,
  type TransactionHistoryPage
} from "../src/application/transactionHistory";
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

const FARM_ID = "farm-history-0001";
const BASE_TIME = "2026-09-07T10:00:00.000Z";

async function setup(): Promise<{ db: NodeSqliteAdapter; repo: LocalFarmRepository }> {
  const db = new NodeSqliteAdapter();
  const repo = new LocalFarmRepository(db);
  const profile = createFarmerProfile({
    id: "profile-history-0001",
    name: "Mehmet Kaya",
    phone: "05321234567",
    province: "Diyarbakır",
    district: "Bismil",
    village: "Örnek",
    totalAreaSquareMeters: squareMetersFromUserInput("100", "decare"),
    cropCodes: ["cotton"]
  });
  await repo.saveInitialFarm({ profile, farmId: FARM_ID, farmName: "Benim Tarlam", nowIso: BASE_TIME });
  return { db, repo };
}

async function add(
  repo: LocalFarmRepository,
  id: string,
  occurredOn: string,
  nowIso: string,
  amountKurus: number
): Promise<void> {
  await repo.addTransaction({
    farmId: FARM_ID,
    nowIso,
    transaction: createFarmTransaction({
      id,
      kind: "expense",
      amountKurus,
      occurredOn,
      category: "Mazot",
      cropCode: "cotton"
    })
  });
}

function requireCursor(page: TransactionHistoryPage): TransactionHistoryCursor {
  if (page.nextCursor === undefined) {
    throw new Error("Test beklenen sonraki kayıt imlecini bulamadı.");
  }
  return page.nextCursor;
}

test("kayıt geçmişi cursor ile sayfalanır; kayıt tekrarı veya kaybı olmaz", async () => {
  const { db, repo } = await setup();
  await add(repo, "txn-history-0001", "2026-09-07", "2026-09-07T10:01:00.000Z", 10_000);
  await add(repo, "txn-history-0002", "2026-09-07", "2026-09-07T10:02:00.000Z", 20_000);
  await add(repo, "txn-history-0003", "2026-09-06", "2026-09-07T10:03:00.000Z", 30_000);
  await add(repo, "txn-history-0004", "2026-09-05", "2026-09-07T10:04:00.000Z", 40_000);
  await add(repo, "txn-history-0005", "2026-09-04", "2026-09-07T10:05:00.000Z", 50_000);

  const history = new LocalTransactionHistory(db);
  const first = await history.page({ farmId: FARM_ID, limit: 2 });
  assert.deepEqual(first.items.map((item) => item.id), ["txn-history-0002", "txn-history-0001"]);

  const second = await history.page({ farmId: FARM_ID, limit: 2, cursor: requireCursor(first) });
  assert.deepEqual(second.items.map((item) => item.id), ["txn-history-0003", "txn-history-0004"]);

  const third = await history.page({ farmId: FARM_ID, limit: 2, cursor: requireCursor(second) });
  assert.deepEqual(third.items.map((item) => item.id), ["txn-history-0005"]);
  assert.equal(third.nextCursor, undefined);

  const allIds = [...first.items, ...second.items, ...third.items].map((item) => item.id);
  assert.equal(new Set(allIds).size, 5);
  db.close();
});

test("aynı tarih ve oluşturma anında kimlik sıralaması cursor kararlılığını korur", async () => {
  const { db, repo } = await setup();
  const sameTime = "2026-09-07T10:10:00.000Z";
  await add(repo, "txn-history-aaa1", "2026-09-07", sameTime, 10_000);
  await add(repo, "txn-history-aaa2", "2026-09-07", sameTime, 20_000);
  await add(repo, "txn-history-aaa3", "2026-09-07", sameTime, 30_000);

  const history = new LocalTransactionHistory(db);
  const first = await history.page({ farmId: FARM_ID, limit: 2 });
  assert.deepEqual(first.items.map((item) => item.id), ["txn-history-aaa3", "txn-history-aaa2"]);
  const second = await history.page({ farmId: FARM_ID, limit: 2, cursor: requireCursor(first) });
  assert.deepEqual(second.items.map((item) => item.id), ["txn-history-aaa1"]);
  db.close();
});

test("silinen finans kaydı geçmiş sayfasına sızmaz", async () => {
  const { db, repo } = await setup();
  await add(repo, "txn-history-live", "2026-09-07", "2026-09-07T10:11:00.000Z", 10_000);
  await add(repo, "txn-history-gone", "2026-09-06", "2026-09-07T10:12:00.000Z", 20_000);
  await repo.softDeleteTransaction({
    farmId: FARM_ID,
    transactionId: "txn-history-gone",
    nowIso: "2026-09-07T10:13:00.000Z"
  });

  const page = await new LocalTransactionHistory(db).page({ farmId: FARM_ID });
  assert.deepEqual(page.items.map((item) => item.id), ["txn-history-live"]);
  db.close();
});

test("geçmiş sayfası sınırsız okuma ve bozuk cursor kabul etmez", async () => {
  const { db } = await setup();
  const history = new LocalTransactionHistory(db);

  await assert.rejects(() => history.page({ farmId: FARM_ID, limit: 41 }), /1-40/);
  await assert.rejects(
    () => history.page({
      farmId: FARM_ID,
      cursor: { occurredOn: "2026-02-31", createdAt: BASE_TIME, id: "txn-history-bad1" }
    }),
    /Gün bilgisi geçersiz/
  );
  db.close();
});
