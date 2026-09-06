import { type SQLiteDatabase } from "expo-sqlite";
import { INITIAL_SCHEMA_SQL, SCHEMA_VERSION } from "../storage/schemaText";
import { ExpoSqliteAdapter } from "./expoSqliteAdapter";

export const DATABASE_NAME = "ciftci-defteri.db";

export async function initializeDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync("PRAGMA foreign_keys = ON;");
  await database.execAsync("PRAGMA journal_mode = WAL;");
  await database.execAsync(INITIAL_SCHEMA_SQL);
  await database.runAsync(
    `INSERT INTO app_meta (key, value) VALUES ('schema_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    String(SCHEMA_VERSION)
  );
}

export function mobileDatabase(database: SQLiteDatabase): ExpoSqliteAdapter {
  return new ExpoSqliteAdapter(database);
}
