declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import { LocalFarmRepository } from "../src/application/localFarmRepository";
import { LocalInventoryRepository } from "../src/application/localInventoryRepository";
import {
  createInventoryItem,
  createInventoryMovement,
  formatInventoryQuantity,
  quantityMilliFromStored,
  quantityMilliFromUserInput
} from "../src/domain/inventory";
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

const FARM_ID = "farm-stock-0001";
const ITEM_ID = "stockitem-0001";
const NOW = "2026-09-07T20:00:00.000Z";
const LATER = "2026-09-08T20:00:00.000Z";
const LATEST = "2026-09-09T20:00:00.000Z";

async function setup() {
  const db = new TestDatabase();
  await migrateDatabase(db);
  const farm = new LocalFarmRepository(db);
  await farm.saveInitialFarm({
    profile: createFarmerProfile({
      id: "profile-stock-0001",
      name: "Mehmet Kaya",
      province: "Diyarbakır",
      district: "Bismil",
      village: "Örnek",
      totalAreaSquareMeters: squareMetersFromUserInput("75", "decare"),
      cropCodes: ["wheat"]
    }),
    farmId: FARM_ID,
    farmName: "Benim Tarlam",
    nowIso: NOW
  });
  return { db, farm, inventory: new LocalInventoryRepository(db) };
}

async function addWheat(inventory: LocalInventoryRepository, quantityMilli = 100_000) {
  const item = createInventoryItem({ id: ITEM_ID, kind: "product", name: "Buğday", unit: "kg" });
  const openingMovement = createInventoryMovement({
    id: "stockmove-open-0001",
    itemId: ITEM_ID,
    kind: "increase",
    quantityMilli,
    occurredOn: "2026-09-07",
    note: "İlk miktar"
  });
  await inventory.addItemWithOpening({ farmId: FARM_ID, item, openingMovement, nowIso: NOW });
}

test("miktar Türkçe ondalıkla binde birlik tam sayıya çevrilir", () => {
  assert.equal(quantityMilliFromUserInput("12,5"), 12_500);
  assert.equal(quantityMilliFromUserInput("0.125"), 125);
  assert.equal(formatInventoryQuantity(quantityMilliFromStored(12_500), "kg"), "12,5 kg");
  assert.throws(() => quantityMilliFromUserInput("1,2345"), /12 veya 12,5/);
  assert.throws(() => quantityMilliFromUserInput("0"), /sıfırdan büyük/);
});

test("ilk stok miktarı ve sonraki hareketler kalanı kaynak kayıtlardan türetir", async () => {
  const { db, inventory } = await setup();
  await addWheat(inventory);
  await inventory.addMovement({
    farmId: FARM_ID,
    movement: createInventoryMovement({
      id: "stockmove-add-0001",
      itemId: ITEM_ID,
      kind: "increase",
      quantityMilli: 25_500,
      occurredOn: "2026-09-08"
    }),
    nowIso: LATER
  });
  await inventory.addMovement({
    farmId: FARM_ID,
    movement: createInventoryMovement({
      id: "stockmove-out-0001",
      itemId: ITEM_ID,
      kind: "decrease",
      quantityMilli: 40_250,
      occurredOn: "2026-09-09"
    }),
    nowIso: LATEST
  });

  const balances = await inventory.listBalances(FARM_ID);
  assert.equal(balances.length, 1);
  assert.equal(balances[0]?.remainingQuantityMilli, 85_250);
  const detail = await inventory.load(FARM_ID, ITEM_ID);
  assert.equal(detail.movements.length, 3);
  assert.equal(detail.movements[0]?.id, "stockmove-out-0001");
  db.close();
});

test("eldekinden fazla miktar azaltılamaz ve yarım hareket bırakılmaz", async () => {
  const { db, inventory } = await setup();
  await addWheat(inventory, 50_000);
  await assert.rejects(
    () => inventory.addMovement({
      farmId: FARM_ID,
      movement: createInventoryMovement({
        id: "stockmove-out-0002",
        itemId: ITEM_ID,
        kind: "decrease",
        quantityMilli: 50_001,
        occurredOn: "2026-09-08"
      }),
      nowIso: LATER
    }),
    /Miktar verisi geçersiz/
  );
  assert.equal((await inventory.load(FARM_ID, ITEM_ID)).movements.length, 1);
  assert.equal((await db.all("PRAGMA foreign_key_check")).length, 0);
  db.close();
});

test("yanlış hareket soft-delete edilir, geri alınır; eksi stok yaratacak silme reddedilir", async () => {
  const { db, inventory } = await setup();
  await addWheat(inventory, 100_000);
  await inventory.addMovement({
    farmId: FARM_ID,
    movement: createInventoryMovement({
      id: "stockmove-out-0003",
      itemId: ITEM_ID,
      kind: "decrease",
      quantityMilli: 80_000,
      occurredOn: "2026-09-08"
    }),
    nowIso: LATER
  });

  await assert.rejects(
    () => inventory.softDeleteMovement({
      farmId: FARM_ID,
      itemId: ITEM_ID,
      movementId: "stockmove-open-0001",
      nowIso: LATEST
    }),
    /Miktar verisi geçersiz/
  );
  assert.equal((await inventory.load(FARM_ID, ITEM_ID)).balance.remainingQuantityMilli, 20_000);

  assert.equal(await inventory.softDeleteMovement({
    farmId: FARM_ID,
    itemId: ITEM_ID,
    movementId: "stockmove-out-0003",
    nowIso: LATEST
  }), true);
  assert.equal((await inventory.load(FARM_ID, ITEM_ID)).balance.remainingQuantityMilli, 100_000);

  assert.equal(await inventory.restoreMovement({
    farmId: FARM_ID,
    itemId: ITEM_ID,
    movementId: "stockmove-out-0003",
    nowIso: LATEST
  }), true);
  assert.equal((await inventory.load(FARM_ID, ITEM_ID)).balance.remainingQuantityMilli, 20_000);
  db.close();
});

test("aynı ad ve birimde aktif stok kalemi ikinci kez oluşturulamaz", async () => {
  const { db, inventory } = await setup();
  await addWheat(inventory);
  await assert.rejects(
    () => inventory.addItemWithOpening({
      farmId: FARM_ID,
      item: createInventoryItem({ id: "stockitem-0002", kind: "product", name: "buğday", unit: "kg" }),
      openingMovement: createInventoryMovement({
        id: "stockmove-open-0002",
        itemId: "stockitem-0002",
        kind: "increase",
        quantityMilli: 10_000,
        occurredOn: "2026-09-08"
      }),
      nowIso: LATER
    }),
    /zaten var/
  );
  assert.equal((await inventory.listBalances(FARM_ID)).length, 1);
  db.close();
});

test("stok giriş çıkışı para defterindeki kâr-zararı değiştirmez", async () => {
  const { db, farm, inventory } = await setup();
  const before = await farm.profitLoss(FARM_ID);
  await addWheat(inventory);
  await inventory.addMovement({
    farmId: FARM_ID,
    movement: createInventoryMovement({
      id: "stockmove-out-0004",
      itemId: ITEM_ID,
      kind: "decrease",
      quantityMilli: 15_000,
      occurredOn: "2026-09-08"
    }),
    nowIso: LATER
  });

  assert.deepEqual(await farm.profitLoss(FARM_ID), before);
  assert.equal((await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM transactions"))?.count, 0);
  db.close();
});
