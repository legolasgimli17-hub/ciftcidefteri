import { type SQLiteDatabase } from "expo-sqlite";
import { SCHEMA_VERSION } from "../storage/schemaText";
import { migrateDatabase } from "../storage/migrations";
import { ExpoSqliteAdapter } from "./expoSqliteAdapter";
import { getOrCreateDatabaseKeyHex, sqlCipherKeyPragma } from "./databaseKey";
import {
  cleanupLegacyPlaintextAfterSuccess,
  isDatabaseReopenRequired,
  legacyDatabaseDiagnosticTagOrUnknown,
  migrateLegacyPlaintextIfNeeded,
  type LegacyDatabaseDiagnosticTag
} from "./legacyDatabaseUpgrade";

export const DATABASE_NAME = "ciftci-defteri.db";

export type DatabaseFailureCode =
  | "DB-KEY"
  | "DB-UPGRADE"
  | "DB-OPEN"
  | "DB-PRAGMA"
  | "DB-MIGRATE"
  | "DB-UNKNOWN";

export interface DatabaseFailureDetails {
  readonly code: DatabaseFailureCode;
  readonly diagnosticTag: LegacyDatabaseDiagnosticTag | null;
}

class DatabaseStartupError extends Error {
  readonly code: DatabaseFailureCode;
  readonly diagnosticTag: LegacyDatabaseDiagnosticTag | null;

  constructor(
    code: DatabaseFailureCode,
    diagnosticTag: LegacyDatabaseDiagnosticTag | null = null
  ) {
    super(code);
    this.name = "DatabaseStartupError";
    this.code = code;
    this.diagnosticTag = diagnosticTag;
  }
}

export async function initializeDatabase(database: SQLiteDatabase): Promise<void> {
  let keyHex: string;
  try {
    keyHex = await getOrCreateDatabaseKeyHex();
  } catch {
    throw new DatabaseStartupError("DB-KEY");
  }

  try {
    await migrateLegacyPlaintextIfNeeded(database, keyHex);
  } catch (error) {
    if (isDatabaseReopenRequired(error)) throw error;
    throw new DatabaseStartupError(
      "DB-UPGRADE",
      legacyDatabaseDiagnosticTagOrUnknown(error)
    );
  }

  try {
    await database.execAsync(sqlCipherKeyPragma(keyHex));

    const cipher = await database.getFirstAsync<{ cipher_version: string }>("PRAGMA cipher_version;");
    if (!cipher?.cipher_version?.trim()) {
      throw new Error("cipher_unavailable");
    }

    await database.getFirstAsync<{ count: number }>(
      "SELECT count(*) AS count FROM sqlite_master;"
    );
  } catch {
    throw new DatabaseStartupError("DB-OPEN");
  }

  try {
    await database.execAsync("PRAGMA foreign_keys = ON;");
    const foreignKeys = await database.getFirstAsync<{ foreign_keys: number }>("PRAGMA foreign_keys;");
    if (Number(foreignKeys?.foreign_keys) !== 1) {
      throw new Error("foreign_keys_unavailable");
    }

    await database.execAsync("PRAGMA journal_mode = WAL;");
    const journal = await database.getFirstAsync<{ journal_mode: string }>("PRAGMA journal_mode;");
    if (journal?.journal_mode?.toLowerCase() !== "wal") {
      throw new Error("wal_unavailable");
    }
  } catch {
    throw new DatabaseStartupError("DB-PRAGMA");
  }

  try {
    const version = await migrateDatabase(mobileDatabase(database));
    if (version !== SCHEMA_VERSION) {
      throw new Error("schema_version_mismatch");
    }
  } catch {
    throw new DatabaseStartupError("DB-MIGRATE");
  }

  cleanupLegacyPlaintextAfterSuccess(database.databasePath);
}

export function databaseFailureDetails(error: unknown): DatabaseFailureDetails {
  if (error instanceof DatabaseStartupError) {
    return { code: error.code, diagnosticTag: error.diagnosticTag };
  }
  if (error instanceof Error) {
    const code = error.message as DatabaseFailureCode;
    if (["DB-KEY", "DB-UPGRADE", "DB-OPEN", "DB-PRAGMA", "DB-MIGRATE"].includes(code)) {
      return { code, diagnosticTag: null };
    }
  }
  return { code: "DB-UNKNOWN", diagnosticTag: null };
}

export function databaseFailureCode(error: unknown): DatabaseFailureCode {
  return databaseFailureDetails(error).code;
}

export { isDatabaseReopenRequired } from "./legacyDatabaseUpgrade";

export function mobileDatabase(database: SQLiteDatabase): ExpoSqliteAdapter {
  return new ExpoSqliteAdapter(database);
}
