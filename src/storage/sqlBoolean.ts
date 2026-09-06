export function parseSqlBoolean(value: number, field: string): boolean {
  if (value === 0) return false;
  if (value === 1) return true;
  throw new Error(`${field} yerel veride geçersiz.`);
}

export function parseNullableSqlBoolean(value: number | null, field: string): boolean | undefined {
  if (value === null) return undefined;
  return parseSqlBoolean(value, field);
}
