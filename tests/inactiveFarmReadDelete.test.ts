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

test("soft-delete edilmiş çiftliğin işlemleri kullanıcı görünümünden okunamaz", async () => {
  const db = new NodeSqliteAdapter();
  const repo = new LocalFarmRepository(db);
  await repo.saveInitialFarm({ profile: profile(), farmId: "farm-0000001", farmName: "Benim Tarlam", nowIso: NOW });
  await repo.addTransaction({
    farmId: "farm-0000001",
    nowIso: NOW,
    transaction: createFarmTransaction({
      id: "txn-income-001",
      kind: "income",
      amountKurus: 100_000,
      occurredOn: "2026-09-06",
      category: "Ürün satışı",
      cropCode: "cotton"
    })
  });
  await db.run("UPDATE farms SET deleted_at=?, updated_at=?, sync_state='pending' WHERE id=?", [LATER, LATER, "farm-0000001"]);

  await assert.rejects(() => repo.listTransactions("farm-0000001"), /aktif değil/);
  await assert.rejects(() => repo.profitLoss("farm-0000001"), /aktif değil/);
  db.close();
});

test("soft-delete edilmiş çiftlikte kullanıcı işlemi silinemez", async () => {
  const db = new NodeSqliteAdapter();
  const repo = new LocalFarmRepository(db);
  await repo.saveInitialFarm({ profile: profile(), farmId: "farm-0000001", farmName: "Benim Tarlam", nowIso: NOW });
  const transaction = createFarmTransaction({
    id: "txn-delete-001",
    kind: "expense",
    amountKurus: 10_000,
    occurredOn: "2026-09-06",
    category: "Mazot",
    cropCode: "cotton"
  });
  await repo.addTransaction({ farmId: "farm-0000001", transaction, nowIso: NOW });
  await db.run("UPDATE farms SET deleted_at=?, updated_at=?, sync_state='pending' WHERE id=?", [LATER, LATER, "farm-0000001"]);

  await assert.rejects(
    () => repo.softDeleteTransaction({ farmId: "farm-0000001", transactionId: transaction.id, nowIso: LATER }),
    /aktif değil/
  );
  const row = await db.first<{ deleted_at: string | null }>("SELECT deleted_at FROM transactions WHERE id=?", [transaction.id]);
  assert.equal(row?.deleted_at, null);
  db.close();
});
