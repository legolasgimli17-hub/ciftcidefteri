import { parseCropCode } from "../domain/crops";
import { assertIsoCalendarDate, assertIsoUtcTimestamp } from "../domain/date";
import { moneyFromKurus } from "../domain/money";
import { createFarmTransaction, type FarmTransaction } from "../domain/transaction";
import { type SqlDatabase } from "../storage/sql";
import { parseSqlBoolean } from "../storage/sqlBoolean";

interface TransactionHistoryRow {
  id: string;
  kind: string;
  amount_kurus: number;
  occurred_on: string;
  category: string;
  crop_code: string | null;
  note: string | null;
  is_tax_exempt_support: number;
  created_at: string;
}

export interface TransactionHistoryCursor {
  readonly occurredOn: string;
  readonly createdAt: string;
  readonly id: string;
}

export interface TransactionHistoryPage {
  readonly items: readonly FarmTransaction[];
  readonly nextCursor?: TransactionHistoryCursor;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 40;

export class LocalTransactionHistory {
  public constructor(private readonly db: SqlDatabase) {}

  public async page(input: {
    readonly farmId: string;
    readonly cursor?: TransactionHistoryCursor;
    readonly limit?: number;
  }): Promise<TransactionHistoryPage> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const limit = validatePageSize(input.limit ?? DEFAULT_PAGE_SIZE);
    const cursor = input.cursor === undefined ? undefined : validateCursor(input.cursor);

    await assertActiveFarm(this.db, farmId);

    const params: Array<string | number | null> = [farmId];
    let cursorSql = "";
    if (cursor !== undefined) {
      cursorSql = `
        AND (
          occurred_on < ?
          OR (occurred_on = ? AND created_at < ?)
          OR (occurred_on = ? AND created_at = ? AND id < ?)
        )`;
      params.push(
        cursor.occurredOn,
        cursor.occurredOn,
        cursor.createdAt,
        cursor.occurredOn,
        cursor.createdAt,
        cursor.id
      );
    }
    params.push(limit + 1);

    const rows = await this.db.all<TransactionHistoryRow>(
      `SELECT id, kind, amount_kurus, occurred_on, category, crop_code, note,
              is_tax_exempt_support, created_at
         FROM transactions
        WHERE farm_id = ? AND deleted_at IS NULL${cursorSql}
        ORDER BY occurred_on DESC, created_at DESC, id DESC
        LIMIT ?`,
      params
    );

    const hasMore = rows.length > limit;
    const visibleRows = hasMore ? rows.slice(0, limit) : rows;
    const items = visibleRows.map(mapHistoryRow);
    const lastRow = visibleRows[visibleRows.length - 1];

    if (!hasMore || lastRow === undefined) {
      return { items };
    }

    return {
      items,
      nextCursor: cursorFromStoredRow(lastRow)
    };
  }
}

async function assertActiveFarm(db: SqlDatabase, farmId: string): Promise<void> {
  const row = await db.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM farms f
       JOIN farmer_profiles p ON p.id = f.owner_local_id
      WHERE f.id = ? AND f.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [farmId]
  );
  if ((row?.count ?? 0) !== 1) {
    throw new Error("Bu çiftlik aktif değil. Kayıt geçmişi açılmadı.");
  }
}

function mapHistoryRow(row: TransactionHistoryRow): FarmTransaction {
  if (row.kind !== "income" && row.kind !== "expense") {
    throw new Error("Yerel veride geçersiz işlem türü bulundu.");
  }
  const cropCode = row.crop_code === null ? undefined : parseCropCode(row.crop_code);
  const isTaxExemptSupport = parseSqlBoolean(row.is_tax_exempt_support, "Destekleme bilgisi");
  return createFarmTransaction({
    id: row.id,
    kind: row.kind,
    amountKurus: moneyFromKurus(row.amount_kurus),
    occurredOn: row.occurred_on,
    category: row.category,
    ...(cropCode === undefined ? {} : { cropCode }),
    ...(row.note === null ? {} : { note: row.note }),
    isTaxExemptSupport
  });
}

function cursorFromStoredRow(row: TransactionHistoryRow): TransactionHistoryCursor {
  assertIsoCalendarDate(row.occurred_on);
  assertIsoUtcTimestamp(row.created_at);
  return {
    occurredOn: row.occurred_on,
    createdAt: row.created_at,
    id: validateId(row.id, "Kayıt imleci")
  };
}

function validateCursor(cursor: TransactionHistoryCursor): TransactionHistoryCursor {
  assertIsoCalendarDate(cursor.occurredOn);
  assertIsoUtcTimestamp(cursor.createdAt);
  return {
    occurredOn: cursor.occurredOn,
    createdAt: cursor.createdAt,
    id: validateId(cursor.id, "Kayıt imleci")
  };
}

function validatePageSize(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PAGE_SIZE) {
    throw new Error(`Kayıt sayısı 1-${MAX_PAGE_SIZE} arasında olmalı.`);
  }
  return value;
}

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) {
    throw new Error(`${field} geçersiz.`);
  }
  return normalized;
}
