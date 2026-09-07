import {
  BACKUP_FORMAT_VERSION,
  BACKUP_MAGIC,
  MAX_BACKUP_ROWS_PER_TABLE,
  MAX_BACKUP_TOTAL_ROWS,
  type BackupPayload,
  type BackupPrimitive,
  type BackupTableData,
  validateBackupPayloadShape
} from "../domain/backup";
import { SCHEMA_VERSION } from "../storage/schemaText";
import { type SqlDatabase, type SqlExecutor } from "../storage/sql";

interface BackupTableSpec {
  readonly name: string;
  readonly minSchemaVersion: number;
  readonly columns: readonly string[];
  readonly orderBy: string;
}

export const BACKUP_TABLE_SPECS: readonly BackupTableSpec[] = [
  {
    name: "farmer_profiles",
    minSchemaVersion: 3,
    columns: [
      "id", "name", "province", "district", "village", "total_area_square_meters",
      "is_cks_registered", "created_at", "updated_at", "deleted_at", "sync_state"
    ],
    orderBy: "id"
  },
  {
    name: "farms",
    minSchemaVersion: 1,
    columns: ["id", "owner_local_id", "display_name", "created_at", "updated_at", "deleted_at", "sync_state"],
    orderBy: "id"
  },
  {
    name: "farm_crops",
    minSchemaVersion: 1,
    columns: ["farm_id", "crop_code", "created_at", "deleted_at", "sync_state"],
    orderBy: "farm_id, crop_code"
  },
  {
    name: "parcels",
    minSchemaVersion: 1,
    columns: [
      "id", "farm_id", "name", "area_square_meters", "crop_code", "season_year",
      "created_at", "updated_at", "deleted_at", "sync_state"
    ],
    orderBy: "id"
  },
  {
    name: "transactions",
    minSchemaVersion: 1,
    columns: [
      "id", "farm_id", "parcel_id", "kind", "amount_kurus", "occurred_on", "category", "crop_code",
      "note", "is_tax_exempt_support", "created_at", "updated_at", "deleted_at", "sync_state"
    ],
    orderBy: "id"
  },
  {
    name: "farm_partners",
    minSchemaVersion: 4,
    columns: ["id", "farm_id", "display_name", "created_at", "updated_at", "deleted_at", "sync_state"],
    orderBy: "id"
  },
  {
    name: "transaction_partnerships",
    minSchemaVersion: 4,
    columns: [
      "transaction_id", "farm_id", "partner_id", "owner_share_basis_points", "cash_actor",
      "created_at", "updated_at", "sync_state"
    ],
    orderBy: "transaction_id"
  },
  {
    name: "partner_settlements",
    minSchemaVersion: 4,
    columns: [
      "id", "farm_id", "partner_id", "amount_kurus", "occurred_on", "direction", "note",
      "created_at", "updated_at", "deleted_at", "sync_state"
    ],
    orderBy: "id"
  },
  {
    name: "debts",
    minSchemaVersion: 5,
    columns: [
      "id", "farm_id", "source_kind", "creditor_name", "total_kurus", "opened_on", "in_kind_description",
      "note", "created_at", "updated_at", "deleted_at", "sync_state"
    ],
    orderBy: "id"
  },
  {
    name: "debt_installments",
    minSchemaVersion: 5,
    columns: [
      "id", "farm_id", "debt_id", "due_on", "amount_kurus", "created_at", "updated_at", "deleted_at", "sync_state"
    ],
    orderBy: "id"
  },
  {
    name: "debt_payments",
    minSchemaVersion: 5,
    columns: [
      "id", "farm_id", "debt_id", "amount_kurus", "occurred_on", "note",
      "created_at", "updated_at", "deleted_at", "sync_state"
    ],
    orderBy: "id"
  },
  {
    name: "bank_movements",
    minSchemaVersion: 6,
    columns: [
      "id", "farm_id", "kind", "amount_kurus", "occurred_on", "bank_name", "note",
      "created_at", "updated_at", "deleted_at", "sync_state"
    ],
    orderBy: "id"
  },
  {
    name: "inventory_items",
    minSchemaVersion: 7,
    columns: [
      "id", "farm_id", "item_kind", "display_name", "unit_code",
      "created_at", "updated_at", "deleted_at", "sync_state"
    ],
    orderBy: "id"
  },
  {
    name: "inventory_movements",
    minSchemaVersion: 7,
    columns: [
      "id", "farm_id", "item_id", "kind", "quantity_milli", "occurred_on", "note",
      "created_at", "updated_at", "deleted_at", "sync_state"
    ],
    orderBy: "id"
  }
] as const;

const DELETE_ORDER = [
  "inventory_movements",
  "inventory_items",
  "bank_movements",
  "debt_payments",
  "debt_installments",
  "debts",
  "partner_settlements",
  "transaction_partnerships",
  "farm_partners",
  "transactions",
  "parcels",
  "farm_crops",
  "farms",
  "farmer_profiles"
] as const;

export async function createBackupPayload(
  database: SqlDatabase,
  createdAt: string
): Promise<BackupPayload> {
  assertIsoTimestamp(createdAt);
  const schemaVersion = await readCurrentSchemaVersion(database);
  if (schemaVersion !== SCHEMA_VERSION) {
    throw new Error("Yerel veritabanı güncel değil. Yedek oluşturulmadı.");
  }

  const specs = tableSpecsForSchema(schemaVersion);
  const tables: BackupTableData[] = [];
  let totalRows = 0;

  for (const spec of specs) {
    const quotedColumns = spec.columns.map(quoteIdentifier).join(", ");
    const rows = await database.all<Record<string, BackupPrimitive>>(
      `SELECT ${quotedColumns} FROM ${quoteIdentifier(spec.name)} ORDER BY ${spec.orderBy}`
    );
    if (rows.length > MAX_BACKUP_ROWS_PER_TABLE) {
      throw new Error("Yedek için bir tabloda çok fazla kayıt var.");
    }
    totalRows += rows.length;
    if (totalRows > MAX_BACKUP_TOTAL_ROWS) {
      throw new Error("Yedek için toplam kayıt sınırı aşıldı.");
    }

    tables.push({
      name: spec.name,
      columns: spec.columns,
      rows: rows.map(row => spec.columns.map(column => normalizeSqlPrimitive(row[column])))
    });
  }

  return {
    magic: BACKUP_MAGIC,
    formatVersion: BACKUP_FORMAT_VERSION,
    sourceSchemaVersion: schemaVersion,
    createdAt,
    tables
  };
}

export async function restoreBackupPayload(
  database: SqlDatabase,
  payload: BackupPayload
): Promise<void> {
  validateBackupPayloadShape(payload, SCHEMA_VERSION);
  validateBackupTableLayout(payload);

  const targetSchemaVersion = await readCurrentSchemaVersion(database);
  if (targetSchemaVersion !== SCHEMA_VERSION) {
    throw new Error("Yerel veritabanı güncel değil. Yedek geri yüklenmedi.");
  }

  const targetSpecs = tableSpecsForSchema(targetSchemaVersion);
  const sourceSpecs = tableSpecsForSchema(payload.sourceSchemaVersion);
  const tableData = new Map(payload.tables.map(table => [table.name, table] as const));

  await database.transaction(async tx => {
    for (const tableName of DELETE_ORDER) {
      const spec = targetSpecs.find(item => item.name === tableName);
      if (spec !== undefined) {
        await tx.run(`DELETE FROM ${quoteIdentifier(spec.name)}`);
      }
    }

    for (const spec of sourceSpecs) {
      const data = tableData.get(spec.name);
      if (data === undefined) {
        throw new Error("Yedek tablosu eksik.");
      }
      await insertTableRows(tx, spec, data);
    }

    const violations = await tx.all<{ table: string; rowid: number | null; parent: string; fkid: number }>(
      "PRAGMA foreign_key_check"
    );
    if (violations.length !== 0) {
      throw new Error("Yedekte ilişkisi bozuk kayıt var. Mevcut kayıtlar değiştirilmedi.");
    }
  });
}

export function validateBackupTableLayout(payload: BackupPayload): void {
  validateBackupPayloadShape(payload, SCHEMA_VERSION);
  const specs = tableSpecsForSchema(payload.sourceSchemaVersion);
  if (payload.tables.length !== specs.length) {
    throw new Error("Yedek tablo sayısı beklenenle uyuşmuyor.");
  }

  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const table = payload.tables[index];
    if (spec === undefined || table === undefined || table.name !== spec.name) {
      throw new Error("Yedek tablo sırası veya adı geçersiz.");
    }
    if (
      table.columns.length !== spec.columns.length ||
      table.columns.some((column, columnIndex) => column !== spec.columns[columnIndex])
    ) {
      throw new Error(`Yedek ${spec.name} sütunları beklenenle uyuşmuyor.`);
    }
  }
}

async function insertTableRows(
  tx: SqlExecutor,
  spec: BackupTableSpec,
  table: BackupTableData
): Promise<void> {
  if (table.rows.length === 0) return;
  const columns = spec.columns.map(quoteIdentifier).join(", ");
  const placeholders = spec.columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${quoteIdentifier(spec.name)} (${columns}) VALUES (${placeholders})`;

  for (const row of table.rows) {
    const result = await tx.run(sql, row);
    if (result.changes !== 1) {
      throw new Error("Yedek kaydı geri yüklenemedi.");
    }
  }
}

function tableSpecsForSchema(schemaVersion: number): readonly BackupTableSpec[] {
  return BACKUP_TABLE_SPECS.filter(spec => spec.minSchemaVersion <= schemaVersion);
}

async function readCurrentSchemaVersion(database: SqlExecutor): Promise<number> {
  const row = await database.first<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'schema_version'"
  );
  if (row === null || !/^[0-9]+$/.test(row.value)) {
    throw new Error("Yerel veritabanı sürümü okunamadı.");
  }
  const version = Number(row.value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("Yerel veritabanı sürümü geçersiz.");
  }
  return version;
}

function normalizeSqlPrimitive(value: BackupPrimitive | undefined): BackupPrimitive {
  if (value === undefined) {
    throw new Error("Yedek sırasında beklenen sütun okunamadı.");
  }
  if (value === null || typeof value === "string") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  throw new Error("Yedek sırasında desteklenmeyen veri türü bulundu.");
}

function quoteIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(identifier)) {
    throw new Error("İç tablo tanımı geçersiz.");
  }
  return `"${identifier}"`;
}

function assertIsoTimestamp(value: string): void {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error("Yedek zamanı geçersiz.");
  }
}
