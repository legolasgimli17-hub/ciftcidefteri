declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import { LocalBankMovementRepository } from "../src/application/localBankMovementRepository";
import { LocalFarmRepository } from "../src/application/localFarmRepository";
import { createBankMovement } from "../src/domain/bankMovement";
import { squareMetersFromUserInput } from "../src/domain/landArea";
import { createFarmerProfile } from "../src/domain/profile";
import { migrateDatabase } from "../src/storage/migrations";
import { type SqlDatabase, type SqlExecutor, type SqlPrimitive, type SqlRunResult } from "../src/storage/sql";

class TestDatabase implements SqlDatabase {
  private readonly db = new DatabaseSync(":memory:");

  public constructor() { this.db.exec("PRAGMA foreign_keys = ON;"); }
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

const FARM_ID = "farm-bank-0001";
const NOW = "2026-09-07T19:00:00.000Z";
const LATER = "2026-09-08T19:00:00.000Z";

async function setup() {
  const db = new TestDatabase();
  await migrateDatabase(db);
  const farm = new LocalFarmRepository(db);
  await farm.saveInitialFarm({
    profile: createFarmerProfile({
      id: "profile-bank-0001",
      name: "Mehmet Kaya",
      province: "Diyarbakır",
      district: "Bismil",
      village: "Örnek",
      totalAreaSquareMeters: squareMetersFromUserInput("60", "decare"),
      cropCodes: ["corn"]
    }),
    farmId: FARM_ID,
    farmName: "Benim Tarlam",
    nowIso: NOW
  });
  return { db, farm, bank: new LocalBankMovementRepository(db) };
}

test("banka hareketi sade alanları normalize eder ve geçersiz türü reddeder", () => {
  const movement = createBankMovement({
    id: "bankmove-0001",
    kind: "withdrawal",
    amountKurus: 125000,
    occurredOn: "2026-09-07",
    bankName: "  Ziraat   Bankası ",
    note: "  Tarladaki ödeme için  "
  });
  assert.equal(movement.bankName, "Ziraat Bankası");
  assert.equal(movement.note, "Tarladaki ödeme için");
  assert.throws(
    () => createBankMovement({
      id: "bankmove-0002",
      kind: "invalid" as "withdrawal",
      amountKurus: 100,
      occurredOn: "2026-09-07"
    }),
    /türü geçersiz/
  );
});

test("banka geçmişi tarihe göre sayfalanır ve cursor kayıt atlamaz", async () => {
  const { db, bank } = await setup();
  await bank.add({
    farmId: FARM_ID,
    movement: createBankMovement({ id: "bankmove-1001", kind: "withdrawal", amountKurus: 100000, occurredOn: "2026-09-07" }),
    nowIso: NOW
  });
  await bank.add({
    farmId: FARM_ID,
    movement: createBankMovement({ id: "bankmove-1002", kind: "deposit", amountKurus: 200000, occurredOn: "2026-09-08" }),
    nowIso: LATER
  });

  const first = await bank.page({ farmId: FARM_ID, limit: 1 });
  assert.equal(first.items.length, 1);
  assert.equal(first.items[0]?.id, "bankmove-1002");
  assert.ok(first.nextCursor);
  const second = await bank.page({ farmId: FARM_ID, limit: 1, cursor: first.nextCursor });
  assert.equal(second.items.length, 1);
  assert.equal(second.items[0]?.id, "bankmove-1001");
  assert.equal(second.nextCursor, undefined);
  db.close();
});

test("bankadan çekmek veya bankaya yatırmak kâr-zararı değiştirmez", async () => {
  const { db, farm, bank } = await setup();
  const before = await farm.profitLoss(FARM_ID);
  await bank.add({
    farmId: FARM_ID,
    movement: createBankMovement({ id: "bankmove-2001", kind: "withdrawal", amountKurus: 300000, occurredOn: "2026-09-07" }),
    nowIso: NOW
  });
  await bank.add({
    farmId: FARM_ID,
    movement: createBankMovement({ id: "bankmove-2002", kind: "deposit", amountKurus: 150000, occurredOn: "2026-09-08" }),
    nowIso: LATER
  });
  assert.deepEqual(await farm.profitLoss(FARM_ID), before);
  assert.equal((await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM transactions"))?.count, 0);
  db.close();
});

test("yanlış banka hareketi soft-delete edilir ve geri alınabilir", async () => {
  const { db, bank } = await setup();
  await bank.add({
    farmId: FARM_ID,
    movement: createBankMovement({ id: "bankmove-3001", kind: "deposit", amountKurus: 50000, occurredOn: "2026-09-07" }),
    nowIso: NOW
  });

  assert.equal(await bank.softDelete({ farmId: FARM_ID, movementId: "bankmove-3001", nowIso: LATER }), true);
  assert.equal((await bank.page({ farmId: FARM_ID })).items.length, 0);
  assert.equal(
    (await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM bank_movements WHERE deleted_at IS NOT NULL"))?.count,
    1
  );

  assert.equal(await bank.restore({ farmId: FARM_ID, movementId: "bankmove-3001", nowIso: LATER }), true);
  assert.equal((await bank.page({ farmId: FARM_ID })).items.length, 1);
  assert.equal((await db.all("PRAGMA foreign_key_check")).length, 0);
  db.close();
});
