export const BACKUP_MAGIC = "ciftci-defteri-backup" as const;
export const BACKUP_FORMAT_VERSION = 1 as const;
export const BACKUP_ALGORITHM = "AES-256-GCM" as const;
export const MIN_BACKUP_SCHEMA_VERSION = 6;
export const MAX_BACKUP_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_BACKUP_ROWS_PER_TABLE = 50_000;
export const MAX_BACKUP_TOTAL_ROWS = 100_000;
export const MAX_BACKUP_STRING_LENGTH = 4_096;

export type BackupPrimitive = string | number | null;

export interface BackupTableData {
  readonly name: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly BackupPrimitive[])[];
}

export interface BackupPayload {
  readonly magic: typeof BACKUP_MAGIC;
  readonly formatVersion: typeof BACKUP_FORMAT_VERSION;
  readonly sourceSchemaVersion: number;
  readonly createdAt: string;
  readonly tables: readonly BackupTableData[];
}

export interface EncryptedBackupHeader {
  readonly magic: typeof BACKUP_MAGIC;
  readonly formatVersion: typeof BACKUP_FORMAT_VERSION;
  readonly algorithm: typeof BACKUP_ALGORITHM;
  readonly sourceSchemaVersion: number;
  readonly createdAt: string;
}

export interface EncryptedBackupEnvelope extends EncryptedBackupHeader {
  readonly sealedDataBase64: string;
}

export function normalizeRecoveryKey(input: string): string {
  const normalized = input.replace(/[\s-]/g, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("Kurtarma anahtarı geçersiz.");
  }
  return normalized;
}

export function formatRecoveryKey(input: string): string {
  const normalized = normalizeRecoveryKey(input);
  return normalized.match(/.{1,4}/g)?.join("-") ?? normalized;
}

export function createEncryptedBackupHeader(input: {
  sourceSchemaVersion: number;
  createdAt: string;
}): EncryptedBackupHeader {
  assertSupportedSchemaNumber(input.sourceSchemaVersion);
  assertIsoTimestamp(input.createdAt);
  return {
    magic: BACKUP_MAGIC,
    formatVersion: BACKUP_FORMAT_VERSION,
    algorithm: BACKUP_ALGORITHM,
    sourceSchemaVersion: input.sourceSchemaVersion,
    createdAt: input.createdAt
  };
}

export function backupAuthenticatedData(header: EncryptedBackupHeader): string {
  return [
    header.magic,
    String(header.formatVersion),
    header.algorithm,
    String(header.sourceSchemaVersion),
    header.createdAt
  ].join("|");
}

export function serializeEncryptedBackupEnvelope(envelope: EncryptedBackupEnvelope): string {
  validateEncryptedBackupEnvelope(envelope, envelope.sourceSchemaVersion);
  return JSON.stringify(envelope);
}

export function parseEncryptedBackupEnvelope(
  raw: string,
  currentSchemaVersion: number
): EncryptedBackupEnvelope {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_BACKUP_FILE_BYTES) {
    throw new Error("Yedek dosyası geçersiz veya çok büyük.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Yedek dosyasının biçimi geçersiz.");
  }
  validateEncryptedBackupEnvelope(parsed, currentSchemaVersion);
  return parsed;
}

export function parseBackupPayload(
  raw: string,
  currentSchemaVersion: number
): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Yedek içeriği okunamadı.");
  }
  validateBackupPayloadShape(parsed, currentSchemaVersion);
  return parsed;
}

export function validateBackupPayloadShape(
  value: unknown,
  currentSchemaVersion: number
): asserts value is BackupPayload {
  assertPlainObject(value, "Yedek içeriği geçersiz.");
  assertExactKeys(value, ["magic", "formatVersion", "sourceSchemaVersion", "createdAt", "tables"]);

  if (value.magic !== BACKUP_MAGIC || value.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error("Bu yedek biçimi desteklenmiyor.");
  }
  assertSourceSchema(value.sourceSchemaVersion, currentSchemaVersion);
  assertIsoTimestamp(value.createdAt);
  if (!Array.isArray(value.tables)) {
    throw new Error("Yedek tablo listesi geçersiz.");
  }

  let totalRows = 0;
  for (const table of value.tables) {
    assertPlainObject(table, "Yedek tablo verisi geçersiz.");
    assertExactKeys(table, ["name", "columns", "rows"]);
    if (typeof table.name !== "string" || table.name.length < 1 || table.name.length > 80) {
      throw new Error("Yedek tablo adı geçersiz.");
    }
    if (!Array.isArray(table.columns) || table.columns.length === 0 || table.columns.length > 40) {
      throw new Error("Yedek tablo sütunları geçersiz.");
    }
    const uniqueColumns = new Set<string>();
    for (const column of table.columns) {
      if (typeof column !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(column) || uniqueColumns.has(column)) {
        throw new Error("Yedek tablo sütunları geçersiz.");
      }
      uniqueColumns.add(column);
    }
    if (!Array.isArray(table.rows) || table.rows.length > MAX_BACKUP_ROWS_PER_TABLE) {
      throw new Error("Yedek tablosunda çok fazla kayıt var.");
    }
    totalRows += table.rows.length;
    if (totalRows > MAX_BACKUP_TOTAL_ROWS) {
      throw new Error("Yedekte çok fazla kayıt var.");
    }
    for (const row of table.rows) {
      if (!Array.isArray(row) || row.length !== table.columns.length) {
        throw new Error("Yedek satırı sütunlarla eşleşmiyor.");
      }
      for (const cell of row) validateBackupPrimitive(cell);
    }
  }
}

export function assertPayloadMatchesEnvelope(
  payload: BackupPayload,
  envelope: EncryptedBackupEnvelope
): void {
  if (
    payload.magic !== envelope.magic ||
    payload.formatVersion !== envelope.formatVersion ||
    payload.sourceSchemaVersion !== envelope.sourceSchemaVersion ||
    payload.createdAt !== envelope.createdAt
  ) {
    throw new Error("Yedek başlığı ile şifreli içerik uyuşmuyor.");
  }
}

function validateEncryptedBackupEnvelope(
  value: unknown,
  currentSchemaVersion: number
): asserts value is EncryptedBackupEnvelope {
  assertPlainObject(value, "Yedek dosyası geçersiz.");
  assertExactKeys(value, [
    "magic",
    "formatVersion",
    "algorithm",
    "sourceSchemaVersion",
    "createdAt",
    "sealedDataBase64"
  ]);
  if (
    value.magic !== BACKUP_MAGIC ||
    value.formatVersion !== BACKUP_FORMAT_VERSION ||
    value.algorithm !== BACKUP_ALGORITHM
  ) {
    throw new Error("Bu şifreli yedek biçimi desteklenmiyor.");
  }
  assertSourceSchema(value.sourceSchemaVersion, currentSchemaVersion);
  assertIsoTimestamp(value.createdAt);
  if (
    typeof value.sealedDataBase64 !== "string" ||
    value.sealedDataBase64.length < 40 ||
    value.sealedDataBase64.length > MAX_BACKUP_FILE_BYTES ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value.sealedDataBase64)
  ) {
    throw new Error("Yedek şifreli içeriği geçersiz.");
  }
}

function assertSourceSchema(value: unknown, currentSchemaVersion: number): asserts value is number {
  assertSupportedSchemaNumber(currentSchemaVersion);
  if (!Number.isSafeInteger(value) || (value as number) < MIN_BACKUP_SCHEMA_VERSION) {
    throw new Error("Yedek veritabanı sürümü desteklenmiyor.");
  }
  if ((value as number) > currentSchemaVersion) {
    throw new Error("Bu yedek daha yeni bir Çiftçi Defteri sürümü istiyor.");
  }
}

function assertSupportedSchemaNumber(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error("Veritabanı sürümü geçersiz.");
  }
}

function assertIsoTimestamp(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length > 40) {
    throw new Error("Yedek tarihi geçersiz.");
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error("Yedek tarihi geçersiz.");
  }
}

function validateBackupPrimitive(value: unknown): asserts value is BackupPrimitive {
  if (value === null) return;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error("Yedekte güvenli olmayan sayısal değer var.");
    }
    return;
  }
  if (typeof value === "string") {
    if (value.length > MAX_BACKUP_STRING_LENGTH) {
      throw new Error("Yedekte izin verilenden uzun metin var.");
    }
    return;
  }
  throw new Error("Yedekte desteklenmeyen veri türü var.");
}

function assertPlainObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error("Yedek dosyasında beklenmeyen alan var.");
  }
}
