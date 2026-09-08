import { File } from "expo-file-system";
import { type SQLiteDatabase } from "expo-sqlite";
import { assertDatabaseKeyHex } from "./databaseKey";

const REOPEN_SIGNAL = "database_reopen_required";
const LEGACY_BACKUP_SUFFIX = ".legacy-plaintext-v03";
const ENCRYPTED_TEMP_SUFFIX = ".sqlcipher-migration";

export function isDatabaseReopenRequired(error: unknown): boolean {
  return error instanceof Error && error.message === REOPEN_SIGNAL;
}

export async function migrateLegacyPlaintextIfNeeded(
  database: SQLiteDatabase,
  keyHex: string
): Promise<void> {
  const databasePath = database.databasePath;
  const mainFile = new File(databasePath);
  const backupFile = new File(`${databasePath}${LEGACY_BACKUP_SUFFIX}`);
  const tempFile = new File(`${databasePath}${ENCRYPTED_TEMP_SUFFIX}`);

  await recoverInterruptedSwapIfNeeded(database, mainFile, backupFile, tempFile);

  if (mainFile.size === 0) return;
  if (!(await canReadAsPlaintext(database))) return;

  if (backupFile.exists) {
    throw new Error("legacy_plaintext_backup_conflict");
  }

  const safeKeyHex = assertDatabaseKeyHex(keyHex);
  if (tempFile.exists) tempFile.delete();

  await database.execAsync("PRAGMA wal_checkpoint(TRUNCATE);");

  let attached = false;
  try {
    await database.runAsync(
      `ATTACH DATABASE ? AS encrypted KEY "x'${safeKeyHex}'"`,
      [tempFile.uri]
    );
    attached = true;

    await database.getFirstAsync("SELECT sqlcipher_export('encrypted');");
    const integrity = await database.getFirstAsync<{ integrity_check: string }>(
      "PRAGMA encrypted.integrity_check;"
    );
    if (integrity?.integrity_check !== "ok") {
      throw new Error("legacy_export_integrity_failed");
    }
  } finally {
    if (attached) {
      await database.execAsync("DETACH DATABASE encrypted;");
    }
  }

  if (!tempFile.exists || tempFile.size === 0) {
    throw new Error("legacy_export_missing");
  }

  await database.closeAsync();
  deleteSidecars(databasePath);

  await mainFile.move(backupFile);
  try {
    await tempFile.move(new File(databasePath));
  } catch (error) {
    if (!new File(databasePath).exists && backupFile.exists) {
      await backupFile.move(new File(databasePath));
    }
    throw error;
  }

  throw new Error(REOPEN_SIGNAL);
}

export function cleanupLegacyPlaintextAfterSuccess(databasePath: string): void {
  const backupFile = new File(`${databasePath}${LEGACY_BACKUP_SUFFIX}`);
  const tempFile = new File(`${databasePath}${ENCRYPTED_TEMP_SUFFIX}`);
  if (backupFile.exists) backupFile.delete();
  if (tempFile.exists) tempFile.delete();
  deleteSidecars(`${databasePath}${LEGACY_BACKUP_SUFFIX}`);
  deleteSidecars(`${databasePath}${ENCRYPTED_TEMP_SUFFIX}`);
}

async function recoverInterruptedSwapIfNeeded(
  database: SQLiteDatabase,
  mainFile: File,
  backupFile: File,
  tempFile: File
): Promise<void> {
  if (!backupFile.exists || mainFile.size !== 0) return;

  await database.closeAsync();
  if (mainFile.exists) mainFile.delete();

  if (tempFile.exists && tempFile.size > 0) {
    await tempFile.move(new File(database.databasePath));
  } else {
    await backupFile.move(new File(database.databasePath));
  }

  throw new Error(REOPEN_SIGNAL);
}

async function canReadAsPlaintext(database: SQLiteDatabase): Promise<boolean> {
  try {
    await database.getFirstAsync<{ count: number }>(
      "SELECT count(*) AS count FROM sqlite_master;"
    );
    return true;
  } catch {
    return false;
  }
}

function deleteSidecars(databasePath: string): void {
  const wal = new File(`${databasePath}-wal`);
  const shm = new File(`${databasePath}-shm`);
  if (wal.exists) wal.delete();
  if (shm.exists) shm.delete();
}
