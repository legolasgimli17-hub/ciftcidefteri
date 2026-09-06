import { type SQLiteDatabase } from "expo-sqlite";
import { type SqlDatabase, type SqlExecutor, type SqlPrimitive, type SqlRunResult } from "../storage/sql";

class ExpoSqlExecutor implements SqlExecutor {
  public constructor(protected readonly db: SQLiteDatabase) {}

  public async exec(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  public async run(sql: string, params: readonly SqlPrimitive[] = []): Promise<SqlRunResult> {
    const result = await this.db.runAsync(sql, [...params]);
    return { changes: result.changes };
  }

  public async first<T extends object>(
    sql: string,
    params: readonly SqlPrimitive[] = []
  ): Promise<T | null> {
    return await this.db.getFirstAsync<T>(sql, [...params]);
  }

  public async all<T extends object>(
    sql: string,
    params: readonly SqlPrimitive[] = []
  ): Promise<readonly T[]> {
    return await this.db.getAllAsync<T>(sql, [...params]);
  }
}

export class ExpoSqliteAdapter extends ExpoSqlExecutor implements SqlDatabase {
  public async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    let completed = false;
    let output!: T;
    await this.db.withExclusiveTransactionAsync(async (txn: SQLiteDatabase) => {
      output = await work(new ExpoSqlExecutor(txn));
      completed = true;
    });
    if (!completed) {
      throw new Error("Yerel kayıt işlemi tamamlanamadı.");
    }
    return output;
  }
}
