declare function require(name: string): any;
const test = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");

import {
  createBackupPayload,
  restoreBackupPayload,
  validateBackupTableLayout
} from "../src/application/localBackupRepository";
import {
  BACKUP_MAGIC,
  MAX_BACKUP_ROWS_PER_TABLE,
  formatRecoveryKey,
  normalizeRecoveryKey,
  validateBackupPayloadShape,
  type BackupPayload
} from "../src/domain/backup";
import { migrateDatabase } from "../src/storage/migrations";
import { SCHEMA_VERSION } from "../src/storage/schemaText";
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

const NOW = "2026-09-07T20:10:00.000Z";
const FARM_ID = "farm-backup-source";

async function seedSource(): Promise<TestDatabase> {
  const db = new TestDatabase();
  await migrateDatabase(db);

  await db.run(
    `INSERT INTO farmer_profiles
      (id, name, province, district, village, total_area_square_meters, is_cks_registered,
       created_at, updated_at, deleted_at, sync_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'local')`,
    ["profile-backup", "Mehmet Kaya", "Diyarbakır", "Bismil", "Örnek", 60000, null, NOW, NOW]
  );
  await db.run(
    `INSERT INTO farms (id, owner_local_id, display_name, created_at, updated_at, deleted_at, sync_state)
     VALUES (?, ?, ?, ?, ?, NULL, 'local')`,
    [FARM_ID, "profile-backup", "Benim Tarlam", NOW, NOW]
  );
  await db.run(
    `INSERT INTO farm_crops (farm_id, crop_code, created_at, deleted_at, sync_state)
     VALUES (?, 'cotton', ?, NULL, 'local')`,
    [FARM_ID, NOW]
  );
  await db.run(
    `INSERT INTO transactions
      (id, farm_id, parcel_id, kind, amount_kurus, occurred_on, category, crop_code, note,
       is_tax_exempt_support, created_at, updated_at, deleted_at, sync_state)
     VALUES (?, ?, NULL, 'income', 1000000, '2026-09-01', 'Ürün satışı', 'cotton', 'İlk satış', 0, ?, ?, NULL, 'local')`,
    ["tx-backup-income", FARM_ID, NOW, NOW]
  );
  await db.run(
    `INSERT INTO transactions
      (id, farm_id, parcel_id, kind, amount_kurus, occurred_on, category, crop_code, note,
       is_tax_exempt_support, created_at, updated_at, deleted_at, sync_state)
     VALUES (?, ?, NULL, 'expense', 250000, '2026-09-02', 'Gübre', 'cotton', '2. uygulama', 0, ?, ?, NULL, 'local')`,
    ["tx-backup-expense", FARM_ID, NOW, NOW]
  );
  await db.run(
    `INSERT INTO transactions
      (id, farm_id, parcel_id, kind, amount_kurus, occurred_on, category, crop_code, note,
       is_tax_exempt_support, created_at, updated_at, deleted_at, sync_state)
     VALUES (?, ?, NULL, 'expense', 50000, '2026-08-20', 'Mazot', 'cotton', 'Yanlış kayıt', 0, ?, ?, ?, 'local')`,
    ["tx-backup-deleted", FARM_ID, NOW, NOW, NOW]
  );
  await db.run(
    `INSERT INTO farm_partners (id, farm_id, display_name, created_at, updated_at, deleted_at, sync_state)
     VALUES (?, ?, 'Ahmet Kaya', ?, ?, NULL, 'local')`,
    ["partner-backup", FARM_ID, NOW, NOW]
  );
  await db.run(
    `INSERT INTO transaction_partnerships
      (transaction_id, farm_id, partner_id, owner_share_basis_points, cash_actor, created_at, updated_at, sync_state)
     VALUES (?, ?, ?, 5000, 'owner', ?, ?, 'local')`,
    ["tx-backup-expense", FARM_ID, "partner-backup", NOW, NOW]
  );
  await db.run(
    `INSERT INTO partner_settlements
      (id, farm_id, partner_id, amount_kurus, occurred_on, direction, note, created_at, updated_at, deleted_at, sync_state)
     VALUES (?, ?, ?, 50000, '2026-09-05', 'partner_to_owner', 'Kısmi ödeme', ?, ?, NULL, 'local')`,
    ["settlement-backup", FARM_ID, "partner-backup", NOW, NOW]
  );
  await db.run(
    `INSERT INTO debts
      (id, farm_id, source_kind, creditor_name, total_kurus, opened_on, in_kind_description, note,
       created_at, updated_at, deleted_at, sync_state)
     VALUES (?, ?, 'bank_cash', 'Ziraat Bankası', 5000000, '2026-08-01', NULL, 'Sezon kredisi', ?, ?, NULL, 'local')`,
    ["debt-backup", FARM_ID, NOW, NOW]
  );
  await db.run(
    `INSERT INTO debt_installments
      (id, farm_id, debt_id, due_on, amount_kurus, created_at, updated_at, deleted_at, sync_state)
     VALUES (?, ?, ?, '2026-12-01', 5000000, ?, ?, NULL, 'local')`,
    ["installment-backup", FARM_ID, "debt-backup", NOW, NOW]
  );
  await db.run(
    `INSERT INTO debt_payments
      (id, farm_id, debt_id, amount_kurus, occurred_on, note, created_at, updated_at, deleted_at, sync_state)
     VALUES (?, ?, ?, 1000000, '2026-09-06', 'İlk ödeme', ?, ?, NULL, 'local')`,
    ["payment-backup", FARM_ID, "debt-backup", NOW, NOW]
  );
  await db.run(
    `INSERT INTO bank_movements
      (id, farm_id, kind, amount_kurus, occurred_on, bank_name, note, created_at, updated_at, deleted_at, sync_state)
     VALUES (?, ?, 'withdrawal', 200000, '2026-09-07', 'Ziraat Bankası', 'Nakit çektim', ?, ?, NULL, 'local')`,
    ["bankmove-backup", FARM_ID, NOW, NOW]
  );

  return db;
}

async function seedTargetMarker(db: TestDatabase): Promise<void> {
  await migrateDatabase(db);
  await db.run(
    `INSERT INTO farmer_profiles
      (id, name, province, district, village, total_area_square_meters, is_cks_registered,
       created_at, updated_at, deleted_at, sync_state)
     VALUES ('profile-target', 'Hedef Kayıt', 'Mardin', 'Kızıltepe', 'Örnek', 10000, NULL, ?, ?, NULL, 'local')`,
    [NOW, NOW]
  );
  await db.run(
    `INSERT INTO farms (id, owner_local_id, display_name, created_at, updated_at, deleted_at, sync_state)
     VALUES ('farm-target', 'profile-target', 'Hedef Tarla', ?, ?, NULL, 'local')`,
    [NOW, NOW]
  );
}

function clonePayload(payload: BackupPayload): any {
  return JSON.parse(JSON.stringify(payload));
}

test("yedek yalnız kaynak gerçek tablolarını ve soft-delete geçmişini taşır", async () => {
  const db = await seedSource();
  const payload = await createBackupPayload(db, NOW);
  const names = payload.tables.map(table => table.name);

  assert.equal(payload.magic, BACKUP_MAGIC);
  assert.equal(payload.sourceSchemaVersion, SCHEMA_VERSION);
  assert.equal(names.includes("app_meta"), false);
  assert.equal(names.includes("transactions"), true);
  assert.equal(names.includes("transaction_partnerships"), true);
  assert.equal(names.includes("debts"), true);
  assert.equal(names.includes("bank_movements"), true);
  assert.equal(names.includes("profit_loss"), false);

  const transactions = payload.tables.find(table => table.name === "transactions");
  assert.equal(transactions?.rows.length, 3);
  const deletedAtIndex = transactions?.columns.indexOf("deleted_at") ?? -1;
  assert.ok(deletedAtIndex >= 0);
  assert.equal(transactions?.rows.some(row => row[deletedAtIndex] === NOW), true);
  db.close();
});

test("tam geri yükleme kaynak kayıtları birebir geri getirir ve app_meta sürümünü ezmez", async () => {
  const source = await seedSource();
  const payload = await createBackupPayload(source, NOW);
  const target = new TestDatabase();
  await seedTargetMarker(target);

  await restoreBackupPayload(target, payload);
  const restored = await createBackupPayload(target, NOW);
  assert.deepEqual(restored.tables, payload.tables);
  const marker = await target.first<{ count: number }>(
    "SELECT COUNT(*) AS count FROM farms WHERE id = 'farm-target'"
  );
  assert.equal(Number(marker?.count), 0);
  const version = await target.first<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'schema_version'"
  );
  assert.equal(version?.value, String(SCHEMA_VERSION));

  source.close();
  target.close();
});

test("bozuk yabancı anahtarlı yedek atomik rollback olur ve hedef veri korunur", async () => {
  const source = await seedSource();
  const payload = clonePayload(await createBackupPayload(source, NOW));
  const farms = payload.tables.find((table: any) => table.name === "farms");
  const ownerIndex = farms.columns.indexOf("owner_local_id");
  farms.rows[0][ownerIndex] = "profile-yok";

  const target = new TestDatabase();
  await seedTargetMarker(target);
  await assert.rejects(() => restoreBackupPayload(target, payload as BackupPayload));
  const marker = await target.first<{ name: string }>(
    "SELECT display_name AS name FROM farms WHERE id = 'farm-target'"
  );
  assert.equal(marker?.name, "Hedef Tarla");

  source.close();
  target.close();
});

test("daha yeni şema, beklenmeyen tablo veya sütun sessizce kabul edilmez", async () => {
  const source = await seedSource();
  const original = await createBackupPayload(source, NOW);

  const newer = clonePayload(original);
  newer.sourceSchemaVersion = SCHEMA_VERSION + 1;
  assert.throws(() => validateBackupPayloadShape(newer, SCHEMA_VERSION), /daha yeni/);

  const wrongName = clonePayload(original);
  wrongName.tables[0].name = "evil_table";
  assert.throws(() => validateBackupTableLayout(wrongName as BackupPayload), /sırası|adı/);

  const wrongColumns = clonePayload(original);
  wrongColumns.tables[0].columns[0] = "unexpected_column";
  assert.throws(() => validateBackupTableLayout(wrongColumns as BackupPayload), /sütun/);
  source.close();
});

test("yedek satır sınırı doğrulamadan önce aşırı içeriği durdurur", async () => {
  const source = await seedSource();
  const payload = clonePayload(await createBackupPayload(source, NOW));
  payload.tables[0].rows = Array.from({ length: MAX_BACKUP_ROWS_PER_TABLE + 1 }, () => []);
  assert.throws(() => validateBackupPayloadShape(payload, SCHEMA_VERSION), /çok fazla kayıt/);
  source.close();
});

test("kurtarma anahtarı yalnız 256 bit hex kabul eder ve okunabilir gruplanır", () => {
  const raw = "0123456789abcdef".repeat(4);
  const grouped = formatRecoveryKey(raw);
  assert.equal(normalizeRecoveryKey(grouped), raw);
  assert.equal(grouped.includes("-"), true);
  assert.throws(() => normalizeRecoveryKey("1234-5678"), /geçersiz/);
  assert.throws(() => normalizeRecoveryKey("z".repeat(64)), /geçersiz/);
});

test("yerel schema_version güncel değilse yedek oluşturma fail-closed olur", async () => {
  const db = await seedSource();
  await db.run("UPDATE app_meta SET value = ? WHERE key = 'schema_version'", [String(SCHEMA_VERSION - 1)]);
  await assert.rejects(() => createBackupPayload(db, NOW), /güncel değil/);
  db.close();
});
