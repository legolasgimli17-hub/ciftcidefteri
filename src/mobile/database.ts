import { type SQLiteDatabase } from "expo-sqlite";
import { SCHEMA_VERSION } from "../storage/schemaText";
import { migrateDatabase } from "../storage/migrations";
import { ExpoSqliteAdapter } from "./expoSqliteAdapter";
import { getOrCreateDatabaseKeyHex, sqlCipherKeyPragma } from "./databaseKey";

export const DATABASE_NAME = "ciftci-defteri.db";

export async function initializeDatabase(database: SQLiteDatabase): Promise<void> {
  const keyHex = await getOrCreateDatabaseKeyHex();
  await database.execAsync(sqlCipherKeyPragma(keyHex));

  const cipher = await database.getFirstAsync<{ cipher_version: string }>("PRAGMA cipher_version;");
  if (!cipher?.cipher_version?.trim()) {
    throw new Error("SQLCipher etkin değil. Finansal veri şifrelenmeden açılamaz.");
  }

  await database.execAsync("PRAGMA foreign_keys = ON;");
  const foreignKeys = await database.getFirstAsync<{ foreign_keys: number }>("PRAGMA foreign_keys;");
  if (Number(foreignKeys?.foreign_keys) !== 1) {
    throw new Error("Yerel veri bütünlüğü koruması açılamadı.");
  }

  await database.execAsync("PRAGMA journal_mode = WAL;");
  const journal = await database.getFirstAsync<{ journal_mode: string }>("PRAGMA journal_mode;");
  if (journal?.journal_mode?.toLowerCase() !== "wal") {
    throw new Error("Yerel veritabanı dayanıklılık modu açılamadı.");
  }

  const version = await migrateDatabase(mobileDatabase(database));
  if (version !== SCHEMA_VERSION) {
    throw new Error("Yerel veritabanı doğru sürüme getirilemedi.");
  }
}

export function mobileDatabase(database: SQLiteDatabase): ExpoSqliteAdapter {
  return new ExpoSqliteAdapter(database);
}
