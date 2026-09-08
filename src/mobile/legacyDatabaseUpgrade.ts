import { File } from "expo-file-system";
import * as SQLite from "expo-sqlite";
import { type SQLiteDatabase } from "expo-sqlite";
import { assertDatabaseKeyHex, sqlCipherKeyPragma } from "./databaseKey";
import {
  cleanupLegacyPlaintextAfterSuccessCore,
  isDatabaseReopenRequiredCore,
  legacyDatabaseDiagnosticTag,
  legacyDatabaseDiagnosticTagOrUnknown,
  migrateLegacyPlaintextCore,
  type LegacyDatabaseDiagnosticTag,
  type LegacyUpgradeDatabase,
  type LegacyUpgradeEnvironment,
  type LegacyUpgradeFile
} from "./legacyDatabaseUpgradeCore";

class ExpoLegacyFile implements LegacyUpgradeFile {
  readonly native: File;
  readonly path: string;

  constructor(path: string) {
    this.path = path;
    this.native = new File(path);
  }

  get exists(): boolean {
    return this.native.exists;
  }

  get size(): number {
    return this.native.size;
  }

  delete(): void {
    this.native.delete();
  }

  async move(destination: LegacyUpgradeFile): Promise<void> {
    if (!(destination instanceof ExpoLegacyFile)) {
      throw new Error("legacy_file_adapter_invalid");
    }
    await this.native.move(destination.native);
  }
}

class ExpoLegacyDatabase implements LegacyUpgradeDatabase {
  readonly databasePath: string;

  constructor(private readonly database: SQLiteDatabase) {
    this.databasePath = database.databasePath;
  }

  execAsync(sql: string): Promise<void> {
    return this.database.execAsync(sql);
  }

  async runAsync(sql: string, params?: readonly unknown[]): Promise<unknown> {
    if (params === undefined) return this.database.runAsync(sql);
    return this.database.runAsync(sql, params as any);
  }

  getFirstAsync<T>(sql: string): Promise<T | null> {
    return this.database.getFirstAsync<T>(sql);
  }

  closeAsync(): Promise<void> {
    return this.database.closeAsync();
  }
}

const environment: LegacyUpgradeEnvironment = {
  file: (path) => new ExpoLegacyFile(path),
  openDatabase: async (fileName, directory) =>
    new ExpoLegacyDatabase(
      await SQLite.openDatabaseAsync(fileName, undefined, directory)
    ),
  assertKeyHex: assertDatabaseKeyHex,
  keyPragma: sqlCipherKeyPragma
};

export function isDatabaseReopenRequired(error: unknown): boolean {
  return isDatabaseReopenRequiredCore(error);
}

export async function migrateLegacyPlaintextIfNeeded(
  database: SQLiteDatabase,
  keyHex: string
): Promise<void> {
  await migrateLegacyPlaintextCore(
    new ExpoLegacyDatabase(database),
    keyHex,
    environment
  );
}

export function cleanupLegacyPlaintextAfterSuccess(databasePath: string): void {
  cleanupLegacyPlaintextAfterSuccessCore(databasePath, environment);
}

export {
  legacyDatabaseDiagnosticTag,
  legacyDatabaseDiagnosticTagOrUnknown,
  type LegacyDatabaseDiagnosticTag
};
