import { parseCropCode, type CropCode } from "../domain/crops";
import { assertIsoCalendarDate, assertIsoUtcTimestamp } from "../domain/date";
import { moneyFromKurus } from "../domain/money";
import { createFarmTransaction, type FarmTransaction, type TransactionKind } from "../domain/transaction";
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

export interface TransactionHistoryFilter {
  readonly kind?: TransactionKind;
  /** undefined = tümü, null = Genel, ürün kodu = yalnız o ürün. */
  readonly cropCode?: CropCode | null;
  readonly category?: string;
  readonly partnerId?: string;
  readonly fromOn?: string;
  readonly toOn?: string;
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
    readonly filter?: TransactionHistoryFilter;
  }): Promise<TransactionHistoryPage> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const limit = validatePageSize(input.limit ?? DEFAULT_PAGE_SIZE);
    const cursor = input.cursor === undefined ? undefined : validateCursor(input.cursor);
    const filter = validateFilter(input.filter);

    await assertActiveFarm(this.db, farmId);

    const params: Array<string | number | null> = [farmId];
    const conditions = ["t.farm_id = ?", "t.deleted_at IS NULL"];

    if (filter.kind !== undefined) {
      conditions.push("t.kind = ?");
      params.push(filter.kind);
    }
    if (filter.cropCode === null) {
      conditions.push("t.crop_code IS NULL");
    } else if (filter.cropCode !== undefined) {
      conditions.push("t.crop_code = ?");
      params.push(filter.cropCode);
    }
    if (filter.category !== undefined) {
      conditions.push("t.category = ?");
      params.push(filter.category);
    }
    if (filter.partnerId !== undefined) {
      conditions.push(`EXISTS (
        SELECT 1
          FROM transaction_partnerships tp
         WHERE tp.farm_id = t.farm_id
           AND tp.transaction_id = t.id
           AND tp.partner_id = ?
      )`);
      params.push(filter.partnerId);
    }
    if (filter.fromOn !== undefined) {
      conditions.push("t.occurred_on >= ?");
      params.push(filter.fromOn);
    }
    if (filter.toOn !== undefined) {
      conditions.push("t.occurred_on <= ?");
      params.push(filter.toOn);
    }

    if (cursor !== undefined) {
      conditions.push(`(
        t.occurred_on < ?
        OR (t.occurred_on = ? AND t.created_at < ?)
        OR (t.occurred_on = ? AND t.created_at = ? AND t.id < ?)
      )`);
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
      `SELECT t.id, t.kind, t.amount_kurus, t.occurred_on, t.category, t.crop_code, t.note,
              t.is_tax_exempt_support, t.created_at
         FROM transactions t
        WHERE ${conditions.join(" AND ")}
        ORDER BY t.occurred_on DESC, t.created_at DESC, t.id DESC
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

function validateFilter(filter: TransactionHistoryFilter | undefined): TransactionHistoryFilter {
  if (filter === undefined) return {};
  if (filter.kind !== undefined && filter.kind !== "income" && filter.kind !== "expense") {
    throw new Error("Kayıt türü filtresi geçersiz.");
  }

  let category: string | undefined;
  if (filter.category !== undefined) {
    category = filter.category.trim().replace(/\s+/g, " ");
    if (category.length < 1 || category.length > 60) throw new Error("Kategori filtresi geçersiz.");
  }

  let partnerId: string | undefined;
  if (filter.partnerId !== undefined) partnerId = validateId(filter.partnerId, "Ortak filtresi");

  if (filter.fromOn !== undefined) assertIsoCalendarDate(filter.fromOn);
  if (filter.toOn !== undefined) assertIsoCalendarDate(filter.toOn);
  if (filter.fromOn !== undefined && filter.toOn !== undefined && filter.fromOn > filter.toOn) {
    throw new Error("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
  }

  return {
    ...(filter.kind === undefined ? {} : { kind: filter.kind }),
    ...(filter.cropCode === undefined ? {} : { cropCode: filter.cropCode === null ? null : parseCropCode(filter.cropCode) }),
    ...(category === undefined ? {} : { category }),
    ...(partnerId === undefined ? {} : { partnerId }),
    ...(filter.fromOn === undefined ? {} : { fromOn: filter.fromOn }),
    ...(filter.toOn === undefined ? {} : { toOn: filter.toOn })
  };
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
