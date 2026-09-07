declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import {
  DATABASE_MIGRATIONS,
  migrateDatabase,
  runMigrations,
  validateMigrationPlan
} from "../src/storage/migrations";
import { SCHEMA_VERSION } from "../src/storage/schemaText";
import { type SqlDatabase, type SqlExecutor, type SqlPrimitive, type SqlRunResult } from "../src/storage/sql";

class NodeMigrationDatabase implements SqlDatabase {
  private readonly db = new DatabaseSync(":memory:");

  public constructor() {
    this.db.exec("PRAGMA foreign_keys = ON;");
  }

  public async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

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

  public setSchemaVersion(value: string): void {
    this.db.exec("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)");
    this.db.prepare(`INSERT INTO app_meta (key,value) VALUES ('schema_version',?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(value);
  }

  public tableExists(name: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
  }

  public indexExists(name: string): boolean {
    return Boolean(this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?").get(name));
  }

  public columnExists(table: string, column: string): boolean {
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return rows.some((row) => row.name === column);
  }

  public close(): void {
    this.db.close();
  }
}

test("migration runner boş veritabanını güncel şemaya getirir", async () => {
  const db = new NodeMigrationDatabase();
  const version = await migrateDatabase(db);
  assert.equal(version, SCHEMA_VERSION);
  assert.equal(db.tableExists("transactions"), true);
  assert.equal(db.tableExists("farm_partners"), true);
  assert.equal(db.tableExists("transaction_partnerships"), true);
  assert.equal(db.tableExists("partner_settlements"), true);
  assert.equal(db.tableExists("debts"), true);
  assert.equal(db.tableExists("debt_installments"), true);
  assert.equal(db.tableExists("debt_payments"), true);
  assert.equal(db.tableExists("bank_movements"), true);
  assert.equal(db.indexExists("idx_transactions_active_history"), true);
  assert.equal(db.indexExists("idx_partner_settlements_partner_date"), true);
  assert.equal(db.indexExists("idx_debts_farm_active"), true);
  assert.equal(db.indexExists("idx_debt_installments_due"), true);
  assert.equal(db.indexExists("idx_debt_payments_date"), true);
  assert.equal(db.indexExists("idx_bank_movements_farm_date"), true);
  assert.equal(db.columnExists("farmer_profiles", "phone"), false);
  db.close();
});

test("mevcut v1 veritabanı güncel sürüme veri kaybetmeden yükselir", async () => {
  const db = new NodeMigrationDatabase();
  assert.equal(await runMigrations(db, DATABASE_MIGRATIONS.slice(0, 1), 1), 1);
  assert.equal(db.indexExists("idx_transactions_active_history"), false);
  assert.equal(db.columnExists("farmer_profiles", "phone"), true);

  assert.equal(await migrateDatabase(db), SCHEMA_VERSION);
  assert.equal(db.tableExists("transactions"), true);
  assert.equal(db.tableExists("partner_settlements"), true);
  assert.equal(db.tableExists("debts"), true);
  assert.equal(db.tableExists("bank_movements"), true);
  assert.equal(db.indexExists("idx_transactions_active_history"), true);
  assert.equal(db.indexExists("idx_debts_farm_active"), true);
  assert.equal(db.indexExists("idx_bank_movements_farm_date"), true);
  assert.equal(db.columnExists("farmer_profiles", "phone"), false);
  db.close();
});

test("v2 veritabanı güncel sürüme telefon ve finans kaydını koruyarak yükselir", async () => {
  const db = new NodeMigrationDatabase();
  assert.equal(await runMigrations(db, DATABASE_MIGRATIONS.slice(0, 2), 2), 2);

  const now = "2026-09-07T10:00:00.000Z";
  await db.run(
    `INSERT INTO farmer_profiles
      (id,name,phone,province,district,village,total_area_square_meters,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    ["profile-v2-01", "Mehmet Kaya", "+905321234567", "Diyarbakır", "Bismil", "Örnek", 100000, now, now]
  );
  await db.run(
    `INSERT INTO farms (id,owner_local_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    ["farm-v2-0001", "profile-v2-01", "Benim Tarlam", now, now]
  );
  await db.run(
    `INSERT INTO farm_crops (farm_id,crop_code,created_at)
     VALUES (?,?,?)`,
    ["farm-v2-0001", "cotton", now]
  );
  await db.run(
    `INSERT INTO transactions
      (id,farm_id,kind,amount_kurus,occurred_on,category,crop_code,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    ["txn-v2-0001", "farm-v2-0001", "income", 125000, "2026-09-07", "Ürün satışı", "cotton", now, now]
  );

  assert.equal(await migrateDatabase(db), SCHEMA_VERSION);
  assert.equal(db.columnExists("farmer_profiles", "phone"), false);
  assert.equal(db.tableExists("farm_partners"), true);
  assert.equal(db.tableExists("transaction_partnerships"), true);
  assert.equal(db.tableExists("partner_settlements"), true);
  assert.equal(db.tableExists("debts"), true);
  assert.equal(db.tableExists("bank_movements"), true);
  assert.equal((await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM farmer_profiles"))?.count, 1);
  assert.equal((await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM farms"))?.count, 1);
  assert.equal((await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM farm_crops"))?.count, 1);
  assert.equal((await db.first<{ count: number }>("SELECT COUNT(*) AS count FROM transactions"))?.count, 1);
  assert.equal((await db.first<{ amount_kurus: number }>("SELECT amount_kurus FROM transactions WHERE id=?", ["txn-v2-0001"]))?.amount_kurus, 125000);
  assert.equal((await db.all("PRAGMA foreign_key_check")).length, 0);
  db.close();
});

test("v4 veritabanı borç tabloları eklenirken mevcut işlem ve ortaklık verisini korur", async () => {
  const db = new NodeMigrationDatabase();
  assert.equal(await runMigrations(db, DATABASE_MIGRATIONS.slice(0, 4), 4), 4);

  const now = "2026-09-07T11:00:00.000Z";
  await db.run(
    `INSERT INTO farmer_profiles
      (id,name,province,district,village,total_area_square_meters,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["profile-v4-0001", "Mehmet Kaya", "Diyarbakır", "Bismil", "Örnek", 100000, now, now]
  );
  await db.run(
    "INSERT INTO farms (id,owner_local_id,display_name,created_at,updated_at) VALUES (?,?,?,?,?)",
    ["farm-v4-0001", "profile-v4-0001", "Benim Tarlam", now, now]
  );
  await db.run(
    "INSERT INTO farm_crops (farm_id,crop_code,created_at) VALUES (?,?,?)",
    ["farm-v4-0001", "cotton", now]
  );
  await db.run(
    `INSERT INTO transactions
      (id,farm_id,kind,amount_kurus,occurred_on,category,crop_code,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    ["txn-v4-0001", "farm-v4-0001", "expense", 250000, "2026-09-07", "Gübre", "cotton", now, now]
  );
  await db.run(
    `INSERT INTO farm_partners (id,farm_id,display_name,created_at,updated_at)
     VALUES (?,?,?,?,?)`,
    ["partner-v4-0001", "farm-v4-0001", "Ahmet Kaya", now, now]
  );
  await db.run(
    `INSERT INTO transaction_partnerships
      (transaction_id,farm_id,partner_id,owner_share_basis_points,cash_actor,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    ["txn-v4-0001", "farm-v4-0001", "partner-v4-0001", 5000, "owner", now, now]
  );

  assert.equal(await migrateDatabase(db), SCHEMA_VERSION);
  assert.equal(db.tableExists("debts"), true);
  assert.equal(db.tableExists("debt_installments"), true);
  assert.equal(db.tableExists("debt_payments"), true);
  assert.equal(db.tableExists("bank_movements"), true);
  assert.equal((await db.first<{ amount_kurus: number }>("SELECT amount_kurus FROM transactions WHERE id=?", ["txn-v4-0001"]))?.amount_kurus, 250000);
  assert.equal((await db.first<{ partner_id: string }>("SELECT partner_id FROM transaction_partnerships WHERE transaction_id=?", ["txn-v4-0001"]))?.partner_id, "partner-v4-0001");
  assert.equal((await db.all("PRAGMA foreign_key_check")).length, 0);
  db.close();
});

test("v5 veritabanı banka hareketleri eklenirken borç ve işlem verisini korur", async () => {
  const db = new NodeMigrationDatabase();
  assert.equal(await runMigrations(db, DATABASE_MIGRATIONS.slice(0, 5), 5), 5);

  const now = "2026-09-07T12:00:00.000Z";
  await db.run(
    `INSERT INTO farmer_profiles
      (id,name,province,district,village,total_area_square_meters,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["profile-v5-0001", "Mehmet Kaya", "Diyarbakır", "Bismil", "Örnek", 100000, now, now]
  );
  await db.run(
    "INSERT INTO farms (id,owner_local_id,display_name,created_at,updated_at) VALUES (?,?,?,?,?)",
    ["farm-v5-0001", "profile-v5-0001", "Benim Tarlam", now, now]
  );
  await db.run(
    "INSERT INTO farm_crops (farm_id,crop_code,created_at) VALUES (?,?,?)",
    ["farm-v5-0001", "wheat", now]
  );
  await db.run(
    `INSERT INTO transactions
      (id,farm_id,kind,amount_kurus,occurred_on,category,crop_code,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    ["txn-v5-0001", "farm-v5-0001", "income", 300000, "2026-09-07", "Ürün satışı", "wheat", now, now]
  );
  await db.run(
    `INSERT INTO debts
      (id,farm_id,source_kind,creditor_name,total_kurus,opened_on,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ["debt-v5-0001", "farm-v5-0001", "bank_cash", "Ziraat Bankası", 500000, "2026-09-07", now, now]
  );
  await db.run(
    `INSERT INTO debt_installments
      (id,farm_id,debt_id,due_on,amount_kurus,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    ["inst-v5-0001", "farm-v5-0001", "debt-v5-0001", "2026-10-01", 500000, now, now]
  );
  await db.run(
    `INSERT INTO debt_payments
      (id,farm_id,debt_id,amount_kurus,occurred_on,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?)`,
    ["pay-v5-000001", "farm-v5-0001", "debt-v5-0001", 100000, "2026-09-08", now, now]
  );

  assert.equal(await migrateDatabase(db), SCHEMA_VERSION);
  assert.equal(db.tableExists("bank_movements"), true);
  assert.equal(db.indexExists("idx_bank_movements_farm_date"), true);
  assert.equal((await db.first<{ amount_kurus: number }>("SELECT amount_kurus FROM transactions WHERE id=?", ["txn-v5-0001"]))?.amount_kurus, 300000);
  assert.equal((await db.first<{ total_kurus: number }>("SELECT total_kurus FROM debts WHERE id=?", ["debt-v5-0001"]))?.total_kurus, 500000);
  assert.equal((await db.first<{ amount_kurus: number }>("SELECT amount_kurus FROM debt_payments WHERE id=?", ["pay-v5-000001"]))?.amount_kurus, 100000);
  assert.equal((await db.all("PRAGMA foreign_key_check")).length, 0);
  db.close();
});

test("migration runner tekrar çalıştırıldığında idempotent kalır", async () => {
  const db = new NodeMigrationDatabase();
  assert.equal(await migrateDatabase(db), SCHEMA_VERSION);
  assert.equal(await migrateDatabase(db), SCHEMA_VERSION);
  assert.equal(db.indexExists("idx_transactions_active_history"), true);
  assert.equal(db.indexExists("idx_partner_settlements_partner_date"), true);
  assert.equal(db.indexExists("idx_debts_farm_active"), true);
  assert.equal(db.indexExists("idx_debt_payments_date"), true);
  assert.equal(db.indexExists("idx_bank_movements_farm_date"), true);
  assert.equal(db.columnExists("farmer_profiles", "phone"), false);
  db.close();
});

test("uygulamadan daha yeni veritabanı güvenli şekilde reddedilir", async () => {
  const db = new NodeMigrationDatabase();
  db.setSchemaVersion(String(SCHEMA_VERSION + 1));
  await assert.rejects(() => migrateDatabase(db), /daha yeni/);
  db.close();
});

test("bozuk schema_version sessizce sıfırlanmaz", async () => {
  const db = new NodeMigrationDatabase();
  db.setSchemaVersion("broken");
  await assert.rejects(() => migrateDatabase(db), /bozuk/);
  db.close();
});

test("migration zincirindeki sürüm boşluğu release'i engeller", () => {
  assert.throws(
    () => validateMigrationPlan([{ version: 2, sql: "SELECT 1;", transactional: true }], 1),
    /sırası bozuk/
  );
});

test("başarısız transactional migration yarım tablo ve sürüm bırakmaz", async () => {
  const db = new NodeMigrationDatabase();
  await assert.rejects(
    () => runMigrations(
      db,
      [{
        version: 1,
        transactional: true,
        sql: "CREATE TABLE partial_table (id INTEGER); THIS IS NOT VALID SQL;"
      }],
      1
    )
  );
  assert.equal(db.tableExists("partial_table"), false);
  assert.equal(
    await db.first<{ value: string }>("SELECT value FROM app_meta WHERE key='schema_version'"),
    null
  );
  db.close();
});
