export const LEGACY_DATABASE_DIAGNOSTIC_TAGS = [
  "legacy_plaintext_backup_conflict",
  "legacy_database_key_invalid",
  "legacy_plaintext_checkpoint_failed",
  "legacy_plaintext_close_failed",
  "legacy_temp_cleanup_failed",
  "legacy_database_path_invalid",
  "legacy_encrypted_open_failed",
  "legacy_encrypted_key_failed",
  "legacy_export_cipher_unavailable",
  "legacy_encrypted_main_probe_failed",
  "legacy_attach_plaintext_failed",
  "legacy_plaintext_probe_failed",
  "legacy_export_failed",
  "legacy_export_integrity_failed",
  "legacy_export_schema_probe_failed",
  "legacy_export_schema_mismatch",
  "legacy_export_finalize_failed",
  "legacy_export_missing",
  "legacy_swap_backup_failed",
  "legacy_swap_activate_failed",
  "legacy_recovery_swap_failed",
  "legacy_upgrade_unknown"
] as const;

export type LegacyDatabaseDiagnosticTag = typeof LEGACY_DATABASE_DIAGNOSTIC_TAGS[number];

const DIAGNOSTIC_TAG_SET = new Set<string>(LEGACY_DATABASE_DIAGNOSTIC_TAGS);
const REOPEN_SIGNAL = "database_reopen_required";
const LEGACY_BACKUP_SUFFIX = ".legacy-plaintext-v03";
const ENCRYPTED_TEMP_SUFFIX = ".sqlcipher-migration";

export interface LegacyUpgradeFile {
  readonly path: string;
  readonly exists: boolean;
  readonly size: number;
  delete(): void;
  move(destination: LegacyUpgradeFile): void | Promise<void>;
}

export interface LegacyUpgradeDatabase {
  readonly databasePath: string;
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: readonly unknown[]): Promise<unknown>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  closeAsync(): Promise<void>;
}

export interface LegacyUpgradeEnvironment {
  file(path: string): LegacyUpgradeFile;
  openDatabase(fileName: string, directory: string): Promise<LegacyUpgradeDatabase>;
  assertKeyHex(keyHex: string): string;
  keyPragma(keyHex: string): string;
}

export function isDatabaseReopenRequiredCore(error: unknown): boolean {
  return error instanceof Error && error.message === REOPEN_SIGNAL;
}

export function legacyDatabaseDiagnosticTag(error: unknown): LegacyDatabaseDiagnosticTag | null {
  if (!(error instanceof Error)) return null;
  return DIAGNOSTIC_TAG_SET.has(error.message)
    ? (error.message as LegacyDatabaseDiagnosticTag)
    : null;
}

export function legacyDatabaseDiagnosticTagOrUnknown(error: unknown): LegacyDatabaseDiagnosticTag {
  return legacyDatabaseDiagnosticTag(error) ?? "legacy_upgrade_unknown";
}

export async function migrateLegacyPlaintextCore(
  database: LegacyUpgradeDatabase,
  keyHex: string,
  env: LegacyUpgradeEnvironment
): Promise<void> {
  const databasePath = database.databasePath;
  const mainFile = env.file(databasePath);
  const backupFile = env.file(`${databasePath}${LEGACY_BACKUP_SUFFIX}`);
  const tempPath = `${databasePath}${ENCRYPTED_TEMP_SUFFIX}`;
  const tempFile = env.file(tempPath);

  await recoverInterruptedSwapIfNeeded(database, mainFile, backupFile, tempFile, env);

  if (!mainFile.exists || mainFile.size === 0) return;
  if (!(await canReadAsPlaintext(database))) return;

  if (backupFile.exists) {
    throw new Error("legacy_plaintext_backup_conflict");
  }

  let safeKeyHex: string;
  try {
    safeKeyHex = env.assertKeyHex(keyHex);
  } catch {
    throw new Error("legacy_database_key_invalid");
  }

  await tagged("legacy_plaintext_checkpoint_failed", () =>
    database.execAsync("PRAGMA wal_checkpoint(TRUNCATE);")
  );
  await tagged("legacy_plaintext_close_failed", () => database.closeAsync());
  await tagged("legacy_temp_cleanup_failed", async () => {
    deleteSidecars(databasePath, env);
    if (tempFile.exists) tempFile.delete();
    deleteSidecars(tempPath, env);
  });

  const location = splitDatabasePath(tempPath);
  let encryptedDatabase: LegacyUpgradeDatabase | null = null;
  let legacyAttached = false;

  try {
    encryptedDatabase = await tagged("legacy_encrypted_open_failed", () =>
      env.openDatabase(location.fileName, location.directory)
    );

    await tagged("legacy_encrypted_key_failed", () =>
      encryptedDatabase!.execAsync(env.keyPragma(safeKeyHex))
    );

    const cipher = await tagged("legacy_encrypted_key_failed", () =>
      encryptedDatabase!.getFirstAsync<{ cipher_version: string }>("PRAGMA cipher_version;")
    );
    if (!cipher?.cipher_version?.trim()) {
      throw new Error("legacy_export_cipher_unavailable");
    }

    await tagged("legacy_encrypted_main_probe_failed", () =>
      encryptedDatabase!.getFirstAsync<{ count: number }>(
        "SELECT count(*) AS count FROM main.sqlite_master;"
      )
    );

    await tagged("legacy_attach_plaintext_failed", () =>
      encryptedDatabase!.runAsync("ATTACH DATABASE ? AS legacy KEY ''", [databasePath])
    );
    legacyAttached = true;

    await tagged("legacy_plaintext_probe_failed", () =>
      encryptedDatabase!.getFirstAsync<{ count: number }>(
        "SELECT count(*) AS count FROM legacy.sqlite_master;"
      )
    );

    await tagged("legacy_export_failed", () =>
      encryptedDatabase!.getFirstAsync("SELECT sqlcipher_export('main', 'legacy');")
    );

    const integrity = await tagged("legacy_export_integrity_failed", () =>
      encryptedDatabase!.getFirstAsync<{ integrity_check: string }>(
        "PRAGMA main.integrity_check;"
      )
    );
    if (integrity?.integrity_check !== "ok") {
      throw new Error("legacy_export_integrity_failed");
    }

    const sourceSchema = await tagged("legacy_export_schema_probe_failed", () =>
      encryptedDatabase!.getFirstAsync<{ count: number }>(
        "SELECT count(*) AS count FROM legacy.sqlite_master WHERE sql IS NOT NULL;"
      )
    );
    const targetSchema = await tagged("legacy_export_schema_probe_failed", () =>
      encryptedDatabase!.getFirstAsync<{ count: number }>(
        "SELECT count(*) AS count FROM main.sqlite_master WHERE sql IS NOT NULL;"
      )
    );
    if (Number(sourceSchema?.count) !== Number(targetSchema?.count)) {
      throw new Error("legacy_export_schema_mismatch");
    }

    await tagged("legacy_export_finalize_failed", () =>
      encryptedDatabase!.execAsync("DETACH DATABASE legacy;")
    );
    legacyAttached = false;
    await tagged("legacy_export_finalize_failed", () => encryptedDatabase!.closeAsync());
    encryptedDatabase = null;
  } catch (error) {
    if (encryptedDatabase !== null) {
      if (legacyAttached) {
        try {
          await encryptedDatabase.execAsync("DETACH DATABASE legacy;");
        } catch {
          // Preserve the first safe diagnostic tag.
        }
      }
      try {
        await encryptedDatabase.closeAsync();
      } catch {
        // Preserve the original plaintext source even if cleanup fails.
      }
    }
    try {
      if (tempFile.exists) tempFile.delete();
      deleteSidecars(tempPath, env);
    } catch {
      // Cleanup failure must never overwrite the primary diagnostic tag.
    }
    throw error;
  }

  if (!tempFile.exists || tempFile.size === 0) {
    throw new Error("legacy_export_missing");
  }

  await tagged("legacy_swap_backup_failed", () => mainFile.move(backupFile));
  try {
    await tagged("legacy_swap_activate_failed", () =>
      tempFile.move(env.file(databasePath))
    );
  } catch (error) {
    if (!env.file(databasePath).exists && backupFile.exists) {
      try {
        await backupFile.move(env.file(databasePath));
      } catch {
        // The original activation error remains the diagnostic source.
      }
    }
    throw error;
  }

  throw new Error(REOPEN_SIGNAL);
}

export function cleanupLegacyPlaintextAfterSuccessCore(
  databasePath: string,
  env: Pick<LegacyUpgradeEnvironment, "file">
): void {
  const backupFile = env.file(`${databasePath}${LEGACY_BACKUP_SUFFIX}`);
  const tempFile = env.file(`${databasePath}${ENCRYPTED_TEMP_SUFFIX}`);
  if (backupFile.exists) backupFile.delete();
  if (tempFile.exists) tempFile.delete();
  deleteSidecars(`${databasePath}${LEGACY_BACKUP_SUFFIX}`, env);
  deleteSidecars(`${databasePath}${ENCRYPTED_TEMP_SUFFIX}`, env);
}

async function recoverInterruptedSwapIfNeeded(
  database: LegacyUpgradeDatabase,
  mainFile: LegacyUpgradeFile,
  backupFile: LegacyUpgradeFile,
  tempFile: LegacyUpgradeFile,
  env: LegacyUpgradeEnvironment
): Promise<void> {
  if (mainFile.exists && mainFile.size > 0) return;
  if (!backupFile.exists && (!tempFile.exists || tempFile.size === 0)) return;

  await tagged("legacy_recovery_swap_failed", async () => {
    await database.closeAsync();
    if (mainFile.exists) mainFile.delete();

    if (tempFile.exists && tempFile.size > 0) {
      await tempFile.move(env.file(database.databasePath));
    } else if (backupFile.exists) {
      await backupFile.move(env.file(database.databasePath));
    }
  });

  throw new Error(REOPEN_SIGNAL);
}

async function canReadAsPlaintext(database: LegacyUpgradeDatabase): Promise<boolean> {
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

function deleteSidecars(
  databasePath: string,
  env: Pick<LegacyUpgradeEnvironment, "file">
): void {
  const wal = env.file(`${databasePath}-wal`);
  const shm = env.file(`${databasePath}-shm`);
  if (wal.exists) wal.delete();
  if (shm.exists) shm.delete();
}

async function tagged<T>(
  tag: LegacyDatabaseDiagnosticTag,
  operation: () => T | Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (legacyDatabaseDiagnosticTag(error) !== null) throw error;
    throw new Error(tag);
  }
}
