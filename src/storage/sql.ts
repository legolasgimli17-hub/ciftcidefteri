export type SqlPrimitive = string | number | null;

export interface SqlRunResult {
  readonly changes: number;
}

export interface SqlExecutor {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly SqlPrimitive[]): Promise<SqlRunResult>;
  first<T extends object>(sql: string, params?: readonly SqlPrimitive[]): Promise<T | null>;
  all<T extends object>(sql: string, params?: readonly SqlPrimitive[]): Promise<readonly T[]>;
}

export interface SqlDatabase extends SqlExecutor {
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}
