declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

import { loadFarmIdentity } from "../src/application/appSnapshot";
import { LocalFarmRepository } from "../src/application/localFarmRepository";
import { assertIsoUtcTimestamp } from "../src/domain/date";
import { createRetryableSingleFlight } from "../src/storage/retryableSingleFlight";
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

test("UTC timestamp takvim ve saat olarak gerçekten geçerli olmalı", () => {
  assert.doesNotThrow(() => assertIsoUtcTimestamp("2028-02-29T23:59:59.999Z"));
  assert.throws(() => assertIsoUtcTimestamp("2026-02-29T12:00:00Z"), /Gün/);
  assert.throws(() => assertIsoUtcTimestamp("2026-12-01T24:00:00Z"), /Saat/);
  assert.throws(() => assertIsoUtcTimestamp("2026-12-01T23:60:00Z"), /Dakika/);
  assert.throws(() => assertIsoUtcTimestamp("2026-12-01T23:59:60Z"), /Saniye/);
});

test("retryable single-flight eşzamanlı çağrıyı birleştirir ve hatadan sonra yeniden dener", async () => {
  let attempts = 0;
  const load = createRetryableSingleFlight(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary");
    return "ok";
  });

  const first = load();
  assert.strictEqual(load(), first);
  await assert.rejects(first, /temporary/);
  assert.equal(await load(), "ok");
  assert.equal(attempts, 2);
});

test("onboarding yalnız profil ile tamamlanmış sayılmaz; aktif çiftlik ve ürün de gerekir", async () => {
  const db = new NodeSqliteAdapter();
  const repository = new LocalFarmRepository(db);
  const now = "2026-09-06T12:00:00.000Z";

  await db.run(
    `INSERT INTO farmer_profiles
      (id,name,phone,province,district,village,total_area_square_meters,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    ["profile-0001", "Mehmet Kaya", "+905321234567", "Diyarbakır", "Bismil", "Örnek", 100000, now, now]
  );
  assert.equal(await repository.hasCompletedOnboarding(), false);

  await db.run(
    `INSERT INTO farms (id,owner_local_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    ["farm-0000001", "profile-0001", "Benim Tarlam", now, now]
  );
  assert.equal(await repository.hasCompletedOnboarding(), false);

  await db.run(
    `INSERT INTO farm_crops (farm_id,crop_code,created_at)
     VALUES (?,?,?)`,
    ["farm-0000001", "cotton", now]
  );
  assert.equal(await repository.hasCompletedOnboarding(), true);

  await db.run(
    "UPDATE farm_crops SET deleted_at=? WHERE farm_id=? AND crop_code=?",
    [now, "farm-0000001", "cotton"]
  );
  assert.equal(await repository.hasCompletedOnboarding(), false);

  db.close();
});

test("birden fazla aktif çiftlik varsa yanlış defter sessizce seçilmez", async () => {
  const db = new NodeSqliteAdapter();
  const now = "2026-09-06T12:00:00.000Z";

  for (const [profileId, farmId, name] of [
    ["profile-0001", "farm-0000001", "Birinci"],
    ["profile-0002", "farm-0000002", "İkinci"]
  ] as const) {
    await db.run(
      `INSERT INTO farmer_profiles
        (id,name,phone,province,district,village,total_area_square_meters,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [profileId, `${name} Çiftçi`, "+905321234567", "Diyarbakır", "Bismil", "Örnek", 100000, now, now]
    );
    await db.run(
      `INSERT INTO farms (id,owner_local_id,display_name,created_at,updated_at)
       VALUES (?,?,?,?,?)`,
      [farmId, profileId, `${name} Çiftlik`, now, now]
    );
    await db.run(
      `INSERT INTO farm_crops (farm_id,crop_code,created_at)
       VALUES (?,?,?)`,
      [farmId, "cotton", now]
    );
  }

  await assert.rejects(() => loadFarmIdentity(db), /birden fazla aktif çiftlik/);
  db.close();
});
