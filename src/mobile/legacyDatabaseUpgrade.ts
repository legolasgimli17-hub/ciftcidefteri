import { File } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { type SQLiteDatabase } from "expo-sqlite";
import { assertDatabaseKeyHex, sqlCipherKeyPragma } from "./databaseKey";

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
  const tempPath = `${databasePath}${ENCRYPTED_TEMP_SUFFIX}`;
  const tempFile = new File(tempPath);

  await recoverInterruptedSwapIfNeeded(database, mainFile, backupFile, tempFile);

  if (mainFile.size === 0) return;
  if (!(await canReadAsPlaintext(database))) return;

  if (backupFile.exists) {
    throw new Error("legacy_plaintext_backup_conflict");
  }

  const safeKeyHex = assertDatabaseKeyHex(keyHex);

  // Flush all plaintext WAL pages before the source connection is closed.
  await database.execAsync("PRAGMA wal_checkpoint(TRUNCATE);");
  await database.closeAsync();
  deleteSidecars(databasePath);

  // A failed previous export may leave only a temporary encrypted file.
  // It is safe to remove here because the original plaintext source still exists.
  if (tempFile.exists) tempFile.delete();
  deleteSidecars(tempPath);

  const location = splitDatabasePath(tempPath);
  let encryptedDatabase: SQLiteDatabase | null = null;
  let legacyAttached = false;

  try {
    // Open the NEW encrypted database as the main connection. This follows
    // SQLCipher's documented plaintext -> encrypted export flow in reverse:
    // encrypted main + attached plaintext source with KEY ''.
    encryptedDatabase = await SQLite.openDatabaseAsync(
      location.fileName,
      undefined,
      location.directory
    );

    await encryptedDatabase.execAsync(sqlCipherKeyPragma(safeKeyHex));
    const cipher = await encryptedDatabase.getFirstAsync<{ cipher_version: string }>(
      "PRAGMA cipher_version;"
    );
    if (!cipher?.cipher_version?.trim()) {
      throw new Error("legacy_export_cipher_unavailable");
    }

    // Force creation/read of the encrypted main database only after its key is set.
    await encryptedDatabase.getFirstAsync<{ count: number }>(
      "SELECT count(*) AS count FROM main.sqlite_master;"
    );

    await encryptedDatabase.runAsync(
      "ATTACH DATABASE ? AS legacy KEY ''",
      [databasePath]
    );
    legacyAttached = true;

    await encryptedDatabase.getFirstAsync<{ count: number }>(
      "SELECT count(*) AS count FROM legacy.sqlite_master;"
    );

    await encryptedDatabase.getFirstAsync(
      "SELECT sqlcipher_export('main', 'legacy');"
    );

    const integrity = await encryptedDatabase.getFirstAsync<{ integrity_check: string }>(
      "PRAGMA main.integrity_check;"
    );
    if (integrity?.integrity_check !== "ok") {
      throw new Error("legacy_export_integrity_failed");
    }

    const sourceSchema = await encryptedDatabase.getFirstAsync<{ count: number }>(
      "SELECT count(*) AS count FROM legacy.sqlite_master WHERE sql IS NOT NULL;"
    );
    const targetSchema = await encryptedDatabase.getFirstAsync<{ count: number }>(
      "SELECT count(*) AS count FROM main.sqlite_master WHERE sql IS NOT NULL;"
    );
    if (Number(sourceSchema?.count) !== Number(targetSchema?.count)) {
      throw new Error("legacy_export_schema_mismatch");
    }

    await encryptedDatabase.execAsync("DETACH DATABASE legacy;");
    legacyAttached = false;
    await encryptedDatabase.closeAsync();
    encryptedDatabase = null;
  } catch (error) {
    if (encryptedDatabase !== null) {
      if (legacyAttached) {
        try {
          await encryptedDatabase.execAsync("DETACH DATABASE legacy;");
        } catch {
          // Closing the connection below is the fail-safe cleanup path.
        }
      }
      try {
        await encryptedDatabase.closeAsync();
      } catch {
        // Keep the original plaintext source untouched even if cleanup fails.
      }
    }
    if (tempFile.exists) tempFile.delete();
    deleteSidecars(tempPath);
    throw error;
  }

  if (!tempFile.exists || tempFile.size === 0) {
    throw new Error("legacy_export_missing");
  }

  // Keep the plaintext source as a recovery copy until the encrypted database
  // has reopened, passed migrations and completed normal startup.
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
  if (mainFile.exists && mainFile.size > 0) return;
  if (!backupFile.exists && (!tempFile.exists || tempFile.size === 0)) return;

  await database.closeAsync();
  if (mainFile.exists) mainFile.delete();

  if (tempFile.exists && tempFile.size > 0) {
    await tempFile.move(new File(database.databasePath));
  } else if (backupFile.exists) {
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

function splitDatabasePath(databasePath: string): {
  readonly directory: string;
  readonly fileName: string;
} {
  const separator = databasePath.lastIndexOf("/");
  if (separator <= 0 || separator === databasePath.length - 1) {
    throw new Error("legacy_database_path_invalid");
  }
  return {
    directory: databasePath.slice(0, separator),
    fileName: databasePath.slice(separator + 1)
  };
}

function deleteSidecars(databasePath: string): void {
  const wal = new File(`${databasePath}-wal`);
  const shm = new File(`${databasePath}-shm`);
  if (wal.exists) wal.delete();
  if (shm.exists) shm.delete();
}
