import { File } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { type SQLiteDatabase } from "expo-sqlite";
import { assertDatabaseKeyHex, sqlCipherKeyPragma } from "./databaseKey";

const REOPEN_SIGNAL = "database_reopen_required";
const LEGACY_BACKUP_SUFFIX = ".legacy-plaintext-v03";
const ENCRYPTED_TEMP_SUFFIX = ".sqlcipher-migration";

export const LEGACY_UPGRADE_DIAGNOSTIC_TAGS = [
  "legacy_plaintext_backup_conflict",
  "legacy_wal_checkpoint_failed",
  "legacy_source_close_failed",
  "legacy_temp_cleanup_failed",
  "legacy_database_path_invalid",
  "legacy_temp_open_failed",
  "legacy_export_key_failed",
  "legacy_export_cipher_unavailable",
  "legacy_export_main_schema_read_failed",
  "legacy_export_attach_failed",
  "legacy_export_source_schema_read_failed",
  "legacy_export_failed",
  "legacy_export_integrity_read_failed",
  "legacy_export_integrity_failed",
  "legacy_export_schema_read_failed",
  "legacy_export_schema_mismatch",
  "legacy_export_detach_failed",
  "legacy_export_close_failed",
  "legacy_export_cleanup_failed",
  "legacy_export_missing",
  "legacy_source_backup_move_failed",
  "legacy_temp_promote_failed",
  "legacy_recovery_close_failed",
  "legacy_recovery_move_failed",
  "legacy_upgrade_unknown"
] as const;

export type LegacyUpgradeDiagnosticTag = typeof LEGACY_UPGRADE_DIAGNOSTIC_TAGS[number];

const LEGACY_UPGRADE_DIAGNOSTIC_TAG_SET = new Set<string>(LEGACY_UPGRADE_DIAGNOSTIC_TAGS);

export function isDatabaseReopenRequired(error: unknown): boolean {
  return error instanceof Error && error.message === REOPEN_SIGNAL;
}

export function legacyUpgradeDiagnosticTag(error: unknown): LegacyUpgradeDiagnosticTag | null {
  if (!(error instanceof Error)) return null;
  return LEGACY_UPGRADE_DIAGNOSTIC_TAG_SET.has(error.message)
    ? error.message as LegacyUpgradeDiagnosticTag
    : null;
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

  // Diagnostics only: each wrapper changes only the safe error label, never the
  // data path or recovery behavior. Raw native messages are not propagated.
  await diagnosticStep("legacy_wal_checkpoint_failed", () =>
    database.execAsync("PRAGMA wal_checkpoint(TRUNCATE);")
  );
  await diagnosticStep("legacy_source_close_failed", () => database.closeAsync());
  deleteSidecars(databasePath);

  await diagnosticStep("legacy_temp_cleanup_failed", async () => {
    if (tempFile.exists) tempFile.delete();
    deleteSidecars(tempPath);
  });

  const location = splitDatabasePath(tempPath);
  let encryptedDatabase: SQLiteDatabase | null = null;
  let legacyAttached = false;

  try {
    encryptedDatabase = await diagnosticStep("legacy_temp_open_failed", () =>
      SQLite.openDatabaseAsync(
        location.fileName,
        undefined,
        location.directory
      )
    );

    await diagnosticStep("legacy_export_key_failed", () =>
      encryptedDatabase!.execAsync(sqlCipherKeyPragma(safeKeyHex))
    );
    const cipher = await diagnosticStep("legacy_export_key_failed", () =>
      encryptedDatabase!.getFirstAsync<{ cipher_version: string }>("PRAGMA cipher_version;")
    );
    if (!cipher?.cipher_version?.trim()) {
      throw new Error("legacy_export_cipher_unavailable");
    }

    await diagnosticStep("legacy_export_main_schema_read_failed", () =>
      encryptedDatabase!.getFirstAsync<{ count: number }>(
        "SELECT count(*) AS count FROM main.sqlite_master;"
      )
    );

    await diagnosticStep("legacy_export_attach_failed", () =>
      encryptedDatabase!.runAsync(
        "ATTACH DATABASE ? AS legacy KEY ''",
        [databasePath]
      )
    );
    legacyAttached = true;

    await diagnosticStep("legacy_export_source_schema_read_failed", () =>
      encryptedDatabase!.getFirstAsync<{ count: number }>(
        "SELECT count(*) AS count FROM legacy.sqlite_master;"
      )
    );

    await diagnosticStep("legacy_export_failed", () =>
      encryptedDatabase!.getFirstAsync(
        "SELECT sqlcipher_export('main', 'legacy');"
      )
    );

    const integrity = await diagnosticStep("legacy_export_integrity_read_failed", () =>
      encryptedDatabase!.getFirstAsync<{ integrity_check: string }>(
        "PRAGMA main.integrity_check;"
      )
    );
    if (integrity?.integrity_check !== "ok") {
      throw new Error("legacy_export_integrity_failed");
    }

    const sourceSchema = await diagnosticStep("legacy_export_schema_read_failed", () =>
      encryptedDatabase!.getFirstAsync<{ count: number }>(
        "SELECT count(*) AS count FROM legacy.sqlite_master WHERE sql IS NOT NULL;"
      )
    );
    const targetSchema = await diagnosticStep("legacy_export_schema_read_failed", () =>
      encryptedDatabase!.getFirstAsync<{ count: number }>(
        "SELECT count(*) AS count FROM main.sqlite_master WHERE sql IS NOT NULL;"
      )
    );
    if (Number(sourceSchema?.count) !== Number(targetSchema?.count)) {
      throw new Error("legacy_export_schema_mismatch");
    }

    await diagnosticStep("legacy_export_detach_failed", () =>
      encryptedDatabase!.execAsync("DETACH DATABASE legacy;")
    );
    legacyAttached = false;
    await diagnosticStep("legacy_export_close_failed", () => encryptedDatabase!.closeAsync());
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
    try {
      if (tempFile.exists) tempFile.delete();
      deleteSidecars(tempPath);
    } catch {
      throw new Error("legacy_export_cleanup_failed");
    }
    throw error;
  }

  if (!tempFile.exists || tempFile.size === 0) {
    throw new Error("legacy_export_missing");
  }

  await diagnosticStep("legacy_source_backup_move_failed", () => mainFile.move(backupFile));
  try {
    await diagnosticStep("legacy_temp_promote_failed", () =>
      tempFile.move(new File(databasePath))
    );
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

  await diagnosticStep("legacy_recovery_close_failed", () => database.closeAsync());
  if (mainFile.exists) mainFile.delete();

  await diagnosticStep("legacy_recovery_move_failed", async () => {
    if (tempFile.exists && tempFile.size > 0) {
      await tempFile.move(new File(database.databasePath));
    } else if (backupFile.exists) {
      await backupFile.move(new File(database.databasePath));
    }
  });

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

async function diagnosticStep<T>(
  tag: LegacyUpgradeDiagnosticTag,
  action: () => Promise<T> | T
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (isDatabaseReopenRequired(error) || legacyUpgradeDiagnosticTag(error) !== null) {
      throw error;
    }
    throw new Error(tag);
  }
}
