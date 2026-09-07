import { parseCropCode, type CropCode } from "../domain/crops";
import { assertIsoUtcTimestamp } from "../domain/date";
import { moneyFromKurus } from "../domain/money";
import { createTransactionPartnership, type TransactionPartnership } from "../domain/partnership";
import { createFarmTransaction, type FarmTransaction } from "../domain/transaction";
import { type SqlDatabase, type SqlExecutor } from "../storage/sql";
import { parseSqlBoolean } from "../storage/sqlBoolean";

interface TransactionRow {
  id: string;
  kind: string;
  amount_kurus: number;
  occurred_on: string;
  category: string;
  crop_code: string | null;
  note: string | null;
  is_tax_exempt_support: number;
}

export class LocalTransactionCorrections {
  public constructor(private readonly db: SqlDatabase) {}

  public async getActiveTransaction(input: {
    readonly farmId: string;
    readonly transactionId: string;
  }): Promise<FarmTransaction | null> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const transactionId = validateId(input.transactionId, "İşlem kimliği");
    await assertActiveFarm(this.db, farmId, "Kayıt açılamadı.");
    const row = await this.db.first<TransactionRow>(
      `SELECT id, kind, amount_kurus, occurred_on, category, crop_code, note, is_tax_exempt_support
         FROM transactions
        WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
      [transactionId, farmId]
    );
    return row === null ? null : validateStoredTransaction(row);
  }

  public async updateTransaction(input: {
    readonly farmId: string;
    readonly transaction: FarmTransaction;
    /** undefined = mevcut ortaklık ilişkisini koru; null = kaldır; değer = ekle/değiştir. */
    readonly partnership?: TransactionPartnership | null;
    readonly nowIso: string;
  }): Promise<boolean> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const transactionId = validateId(input.transaction.id, "İşlem kimliği");
    assertIsoUtcTimestamp(input.nowIso);
    const transaction = input.transaction;
    const partnership = input.partnership === undefined || input.partnership === null
      ? input.partnership
      : createTransactionPartnership(input.partnership);

    return await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId, "Kayıt değiştirilmedi.");
      if (transaction.cropCode !== undefined) {
        await assertActiveCrop(tx, farmId, transaction.cropCode, "Kayıt değiştirilmedi.");
      }
      if (partnership !== undefined && partnership !== null) {
        await assertActivePartner(tx, farmId, partnership.partnerId, "Kayıt değiştirilmedi.");
      }

      const result = await tx.run(
        `UPDATE transactions
            SET kind = ?, amount_kurus = ?, occurred_on = ?, category = ?, crop_code = ?,
                note = ?, is_tax_exempt_support = ?, updated_at = ?, sync_state = 'pending'
          WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
        [
          transaction.kind,
          transaction.amountKurus,
          transaction.occurredOn,
          transaction.category,
          transaction.cropCode ?? null,
          transaction.note ?? null,
          transaction.isTaxExemptSupport ? 1 : 0,
          input.nowIso,
          transactionId,
          farmId
        ]
      );
      if (result.changes !== 1) return false;

      if (partnership === null) {
        await tx.run(
          `DELETE FROM transaction_partnerships
            WHERE transaction_id = ? AND farm_id = ?`,
          [transactionId, farmId]
        );
      } else if (partnership !== undefined) {
        await tx.run(
          `INSERT INTO transaction_partnerships
            (transaction_id, farm_id, partner_id, owner_share_basis_points, cash_actor,
             created_at, updated_at, sync_state)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'local')
           ON CONFLICT(transaction_id) DO UPDATE SET
             farm_id = excluded.farm_id,
             partner_id = excluded.partner_id,
             owner_share_basis_points = excluded.owner_share_basis_points,
             cash_actor = excluded.cash_actor,
             updated_at = excluded.updated_at,
             sync_state = 'pending'`,
          [
            transactionId,
            farmId,
            partnership.partnerId,
            partnership.ownerShareBasisPoints,
            partnership.cashActor,
            input.nowIso,
            input.nowIso
          ]
        );
      }

      return true;
    });
  }

  public async restoreTransaction(input: {
    readonly farmId: string;
    readonly transactionId: string;
    readonly nowIso: string;
  }): Promise<boolean> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const transactionId = validateId(input.transactionId, "İşlem kimliği");
    assertIsoUtcTimestamp(input.nowIso);

    return await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId, "Kayıt geri alınmadı.");
      const row = await tx.first<TransactionRow>(
        `SELECT id, kind, amount_kurus, occurred_on, category, crop_code, note, is_tax_exempt_support
           FROM transactions
          WHERE id = ? AND farm_id = ? AND deleted_at IS NOT NULL`,
        [transactionId, farmId]
      );
      if (row === null) return false;

      const transaction = validateStoredTransaction(row);
      if (transaction.cropCode !== undefined) {
        await assertActiveCrop(tx, farmId, transaction.cropCode, "Kayıt geri alınmadı.");
      }

      const result = await tx.run(
        `UPDATE transactions
            SET deleted_at = NULL, updated_at = ?, sync_state = 'pending'
          WHERE id = ? AND farm_id = ? AND deleted_at IS NOT NULL`,
        [input.nowIso, transactionId, farmId]
      );
      return result.changes === 1;
    });
  }
}

async function assertActiveFarm(database: SqlExecutor, farmId: string, suffix: string): Promise<void> {
  const farm = await database.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM farms f
       JOIN farmer_profiles p ON p.id = f.owner_local_id
      WHERE f.id = ? AND f.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [farmId]
  );
  if ((farm?.count ?? 0) !== 1) {
    throw new Error(`Bu çiftlik aktif değil. ${suffix}`);
  }
}

async function assertActiveCrop(
  database: SqlExecutor,
  farmId: string,
  cropCode: CropCode,
  suffix: string
): Promise<void> {
  const crop = await database.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM farm_crops
      WHERE farm_id = ? AND crop_code = ? AND deleted_at IS NULL`,
    [farmId, cropCode]
  );
  if ((crop?.count ?? 0) !== 1) {
    throw new Error(`Bu ürün artık çiftliğinde kayıtlı değil. ${suffix}`);
  }
}

async function assertActivePartner(
  database: SqlExecutor,
  farmId: string,
  partnerId: string,
  suffix: string
): Promise<void> {
  const row = await database.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM farm_partners
      WHERE farm_id = ? AND id = ? AND deleted_at IS NULL`,
    [farmId, partnerId]
  );
  if ((row?.count ?? 0) !== 1) {
    throw new Error(`Bu ortak artık aktif değil. ${suffix}`);
  }
}

function validateStoredTransaction(row: TransactionRow): FarmTransaction {
  if (row.kind !== "income" && row.kind !== "expense") {
    throw new Error("Kayıt türü geçersiz. İşlem yapılmadı.");
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

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) {
    throw new Error(`${field} geçersiz.`);
  }
  return normalized;
}
