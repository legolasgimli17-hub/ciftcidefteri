import { assertIsoCalendarDate, assertIsoUtcTimestamp } from "../domain/date";
import {
  createBankMovement,
  parseBankMovementKind,
  type BankMovement
} from "../domain/bankMovement";
import { type SqlDatabase, type SqlExecutor } from "../storage/sql";

interface StoredBankMovementRow {
  id: string;
  kind: string;
  amount_kurus: number;
  occurred_on: string;
  bank_name: string | null;
  note: string | null;
  created_at: string;
}

export interface BankMovementCursor {
  readonly occurredOn: string;
  readonly createdAt: string;
  readonly id: string;
}

export interface BankMovementPage {
  readonly items: readonly BankMovement[];
  readonly nextCursor?: BankMovementCursor;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 40;

export class LocalBankMovementRepository {
  public constructor(private readonly db: SqlDatabase) {}

  public async add(input: {
    readonly farmId: string;
    readonly movement: BankMovement;
    readonly nowIso: string;
  }): Promise<void> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const movement = createBankMovement(input.movement);
    assertIsoUtcTimestamp(input.nowIso);

    await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      await tx.run(
        `INSERT INTO bank_movements
          (id, farm_id, kind, amount_kurus, occurred_on, bank_name, note, created_at, updated_at, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local')`,
        [
          movement.id,
          farmId,
          movement.kind,
          movement.amountKurus,
          movement.occurredOn,
          movement.bankName ?? null,
          movement.note ?? null,
          input.nowIso,
          input.nowIso
        ]
      );
    });
  }

  public async page(input: {
    readonly farmId: string;
    readonly cursor?: BankMovementCursor;
    readonly limit?: number;
  }): Promise<BankMovementPage> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const limit = validatePageSize(input.limit ?? DEFAULT_PAGE_SIZE);
    const cursor = input.cursor === undefined ? undefined : validateCursor(input.cursor);
    await assertActiveFarm(this.db, farmId);

    const params: Array<string | number> = [farmId];
    const conditions = ["farm_id = ?", "deleted_at IS NULL"];
    if (cursor !== undefined) {
      conditions.push(`(
        occurred_on < ?
        OR (occurred_on = ? AND created_at < ?)
        OR (occurred_on = ? AND created_at = ? AND id < ?)
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

    const rows = await this.db.all<StoredBankMovementRow>(
      `SELECT id, kind, amount_kurus, occurred_on, bank_name, note, created_at
         FROM bank_movements
        WHERE ${conditions.join(" AND ")}
        ORDER BY occurred_on DESC, created_at DESC, id DESC
        LIMIT ?`,
      params
    );

    const hasMore = rows.length > limit;
    const visibleRows = hasMore ? rows.slice(0, limit) : rows;
    const items = visibleRows.map(mapStoredMovement);
    const last = visibleRows[visibleRows.length - 1];
    if (!hasMore || last === undefined) return { items };
    return { items, nextCursor: cursorFromRow(last) };
  }

  public async softDelete(input: {
    readonly farmId: string;
    readonly movementId: string;
    readonly nowIso: string;
  }): Promise<boolean> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const movementId = validateId(input.movementId, "Banka hareketi kimliği");
    assertIsoUtcTimestamp(input.nowIso);

    return this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      const result = await tx.run(
        `UPDATE bank_movements
            SET deleted_at = ?, updated_at = ?, sync_state = 'local'
          WHERE farm_id = ? AND id = ? AND deleted_at IS NULL`,
        [input.nowIso, input.nowIso, farmId, movementId]
      );
      return result.changes === 1;
    });
  }

  public async restore(input: {
    readonly farmId: string;
    readonly movementId: string;
    readonly nowIso: string;
  }): Promise<boolean> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const movementId = validateId(input.movementId, "Banka hareketi kimliği");
    assertIsoUtcTimestamp(input.nowIso);

    return this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      const result = await tx.run(
        `UPDATE bank_movements
            SET deleted_at = NULL, updated_at = ?, sync_state = 'local'
          WHERE farm_id = ? AND id = ? AND deleted_at IS NOT NULL`,
        [input.nowIso, farmId, movementId]
      );
      return result.changes === 1;
    });
  }
}

function mapStoredMovement(row: StoredBankMovementRow): BankMovement {
  return createBankMovement({
    id: row.id,
    kind: parseBankMovementKind(row.kind),
    amountKurus: row.amount_kurus,
    occurredOn: row.occurred_on,
    ...(row.bank_name === null ? {} : { bankName: row.bank_name }),
    ...(row.note === null ? {} : { note: row.note })
  });
}

function cursorFromRow(row: StoredBankMovementRow): BankMovementCursor {
  assertIsoCalendarDate(row.occurred_on);
  assertIsoUtcTimestamp(row.created_at);
  return {
    occurredOn: row.occurred_on,
    createdAt: row.created_at,
    id: validateId(row.id, "Banka hareketi imleci")
  };
}

function validateCursor(cursor: BankMovementCursor): BankMovementCursor {
  assertIsoCalendarDate(cursor.occurredOn);
  assertIsoUtcTimestamp(cursor.createdAt);
  return {
    occurredOn: cursor.occurredOn,
    createdAt: cursor.createdAt,
    id: validateId(cursor.id, "Banka hareketi imleci")
  };
}

function validatePageSize(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PAGE_SIZE) {
    throw new Error(`Banka hareketi sayısı 1-${MAX_PAGE_SIZE} arasında olmalı.`);
  }
  return value;
}

async function assertActiveFarm(database: SqlExecutor, farmId: string): Promise<void> {
  const row = await database.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM farms f
       JOIN farmer_profiles p ON p.id = f.owner_local_id
      WHERE f.id = ? AND f.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [farmId]
  );
  if ((row?.count ?? 0) !== 1) throw new Error("Bu çiftlik aktif değil. Banka hareketleri değiştirilmedi.");
}

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) throw new Error(`${field} geçersiz.`);
  return normalized;
}
