import { parseCropCode, type CropCode } from "../domain/crops";
import { assertIsoUtcTimestamp } from "../domain/date";
import { moneyFromKurus } from "../domain/money";
import { createTransactionPartnership, type TransactionPartnership } from "../domain/partnership";
import { type FarmerProfile } from "../domain/profile";
import { createProfitLossSummary, type ProfitLossSummary } from "../domain/profitLoss";
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

interface ProfitLossAggregateRow {
  income_kurus: number;
  expense_kurus: number;
  tax_exempt_support_kurus: number;
  invalid_kind_count: number;
  invalid_amount_count: number;
  invalid_support_boolean_count: number;
  invalid_support_scope_count: number;
}

const MAX_RECENT_TRANSACTION_LIMIT = 50;

export class LocalFarmRepository {
  public constructor(private readonly db: SqlDatabase) {}

  public async hasCompletedOnboarding(): Promise<boolean> {
    const row = await this.db.first<{ complete: number }>(
      `SELECT EXISTS(
         SELECT 1
           FROM farmer_profiles p
           JOIN farms f ON f.owner_local_id = p.id AND f.deleted_at IS NULL
           JOIN farm_crops c ON c.farm_id = f.id AND c.deleted_at IS NULL
          WHERE p.deleted_at IS NULL
          LIMIT 1
       ) AS complete`
    );
    return Number(row?.complete ?? 0) === 1;
  }

  public async saveInitialFarm(input: {
    readonly profile: FarmerProfile;
    readonly farmId: string;
    readonly farmName: string;
    readonly nowIso: string;
  }): Promise<void> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const farmName = normalizeText(input.farmName, "Çiftlik adı", 1, 80);
    const nowIso = validateTimestamp(input.nowIso);

    await this.db.transaction(async (tx) => {
      await prepareInitialSetup(tx, nowIso);
      await insertProfile(tx, input.profile, nowIso);
      await tx.run(
        `INSERT INTO farms
          (id, owner_local_id, display_name, created_at, updated_at, sync_state)
         VALUES (?, ?, ?, ?, ?, 'local')`,
        [farmId, input.profile.id, farmName, nowIso, nowIso]
      );

      for (const cropCode of input.profile.cropCodes) {
        await tx.run(
          `INSERT INTO farm_crops (farm_id, crop_code, created_at, sync_state)
           VALUES (?, ?, ?, 'local')`,
          [farmId, cropCode, nowIso]
        );
      }
    });
  }

  public async addTransaction(input: {
    readonly farmId: string;
    readonly transaction: FarmTransaction;
    readonly partnership?: TransactionPartnership;
    readonly nowIso: string;
  }): Promise<void> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const nowIso = validateTimestamp(input.nowIso);
    const t = input.transaction;
    const partnership = input.partnership === undefined
      ? undefined
      : createTransactionPartnership(input.partnership);

    await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);

      if (t.cropCode !== undefined) {
        const crop = await tx.first<{ count: number }>(
          `SELECT COUNT(*) AS count
             FROM farm_crops
            WHERE farm_id = ? AND crop_code = ? AND deleted_at IS NULL`,
          [farmId, t.cropCode]
        );
        if ((crop?.count ?? 0) !== 1) {
          throw new Error("Bu ürün çiftliğinde kayıtlı değil.");
        }
      }

      if (partnership !== undefined) {
        const partner = await tx.first<{ count: number }>(
          `SELECT COUNT(*) AS count
             FROM farm_partners
            WHERE farm_id = ? AND id = ? AND deleted_at IS NULL`,
          [farmId, partnership.partnerId]
        );
        if ((partner?.count ?? 0) !== 1) {
          throw new Error("Bu ortak aktif değil. Kayıt eklenmedi.");
        }
      }

      await tx.run(
        `INSERT INTO transactions
          (id, farm_id, kind, amount_kurus, occurred_on, category, crop_code, note,
           is_tax_exempt_support, created_at, updated_at, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local')`,
        [
          t.id,
          farmId,
          t.kind,
          t.amountKurus,
          t.occurredOn,
          t.category,
          t.cropCode ?? null,
          t.note ?? null,
          t.isTaxExemptSupport ? 1 : 0,
          nowIso,
          nowIso
        ]
      );

      if (partnership !== undefined) {
        await tx.run(
          `INSERT INTO transaction_partnerships
            (transaction_id, farm_id, partner_id, owner_share_basis_points, cash_actor,
             created_at, updated_at, sync_state)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'local')`,
          [
            t.id,
            farmId,
            partnership.partnerId,
            partnership.ownerShareBasisPoints,
            partnership.cashActor,
            nowIso,
            nowIso
          ]
        );
      }
    });
  }

  public async listTransactions(farmIdRaw: string): Promise<readonly FarmTransaction[]> {
    const farmId = validateId(farmIdRaw, "Çiftlik kimliği");
    await assertActiveFarm(this.db, farmId);
    const rows = await this.db.all<TransactionRow>(
      `SELECT id, kind, amount_kurus, occurred_on, category, crop_code, note, is_tax_exempt_support
         FROM transactions
        WHERE farm_id = ? AND deleted_at IS NULL
        ORDER BY occurred_on DESC, created_at DESC`,
      [farmId]
    );
    return rows.map(mapTransactionRow);
  }

  public async listRecentTransactions(
    farmIdRaw: string,
    limitRaw = 4
  ): Promise<readonly FarmTransaction[]> {
    const farmId = validateId(farmIdRaw, "Çiftlik kimliği");
    const limit = validateRecentLimit(limitRaw);
    await assertActiveFarm(this.db, farmId);
    const rows = await this.db.all<TransactionRow>(
      `SELECT id, kind, amount_kurus, occurred_on, category, crop_code, note, is_tax_exempt_support
         FROM transactions
        WHERE farm_id = ? AND deleted_at IS NULL
        ORDER BY occurred_on DESC, created_at DESC
        LIMIT ?`,
      [farmId, limit]
    );
    return rows.map(mapTransactionRow);
  }

  public async profitLoss(farmIdRaw: string): Promise<ProfitLossSummary> {
    const farmId = validateId(farmIdRaw, "Çiftlik kimliği");
    await assertActiveFarm(this.db, farmId);
    const row = await this.db.first<ProfitLossAggregateRow>(
      `SELECT
         COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_kurus ELSE 0 END), 0) AS income_kurus,
         COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_kurus ELSE 0 END), 0) AS expense_kurus,
         COALESCE(SUM(CASE
           WHEN kind = 'income' AND is_tax_exempt_support = 1 THEN amount_kurus ELSE 0 END), 0)
           AS tax_exempt_support_kurus,
         COALESCE(SUM(CASE
           WHEN kind IS NULL OR kind NOT IN ('income','expense') THEN 1 ELSE 0 END), 0)
           AS invalid_kind_count,
         COALESCE(SUM(CASE
           WHEN typeof(amount_kurus) <> 'integer' OR amount_kurus <= 0 THEN 1 ELSE 0 END), 0)
           AS invalid_amount_count,
         COALESCE(SUM(CASE
           WHEN is_tax_exempt_support IS NULL OR is_tax_exempt_support NOT IN (0,1) THEN 1 ELSE 0 END), 0)
           AS invalid_support_boolean_count,
         COALESCE(SUM(CASE
           WHEN is_tax_exempt_support = 1 AND kind <> 'income' THEN 1 ELSE 0 END), 0)
           AS invalid_support_scope_count
       FROM transactions
       WHERE farm_id = ? AND deleted_at IS NULL`,
      [farmId]
    );

    if (row === null) {
      throw new Error("Kâr/zarar özeti okunamadı.");
    }
    if (
      row.invalid_kind_count !== 0 ||
      row.invalid_amount_count !== 0 ||
      row.invalid_support_boolean_count !== 0 ||
      row.invalid_support_scope_count !== 0
    ) {
      throw new Error("Yerel finans verisinde geçersiz kayıt bulundu. Özet gösterilmedi.");
    }

    return createProfitLossSummary({
      incomeKurus: moneyFromKurus(row.income_kurus),
      expenseKurus: moneyFromKurus(row.expense_kurus),
      taxExemptSupportIncomeKurus: moneyFromKurus(row.tax_exempt_support_kurus)
    });
  }

  public async softDeleteTransaction(input: {
    readonly farmId: string;
    readonly transactionId: string;
    readonly nowIso: string;
  }): Promise<boolean> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const transactionId = validateId(input.transactionId, "İşlem kimliği");
    const nowIso = validateTimestamp(input.nowIso);

    return await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      const result = await tx.run(
        `UPDATE transactions
         SET deleted_at = ?, updated_at = ?, sync_state = 'pending'
         WHERE id = ? AND farm_id = ? AND deleted_at IS NULL`,
        [nowIso, nowIso, transactionId, farmId]
      );
      return result.changes === 1;
    });
  }
}

async function assertActiveFarm(database: SqlExecutor, farmId: string): Promise<void> {
  const farm = await database.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM farms f
       JOIN farmer_profiles p ON p.id = f.owner_local_id
      WHERE f.id = ? AND f.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [farmId]
  );
  if ((farm?.count ?? 0) !== 1) {
    throw new Error("Bu çiftlik aktif değil. İşlem yapılmadı.");
  }
}

async function prepareInitialSetup(tx: SqlExecutor, nowIso: string): Promise<void> {
  const complete = await tx.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM farmer_profiles p
       JOIN farms f ON f.owner_local_id = p.id AND f.deleted_at IS NULL
       JOIN farm_crops c ON c.farm_id = f.id AND c.deleted_at IS NULL
      WHERE p.deleted_at IS NULL`
  );
  if ((complete?.count ?? 0) > 0) {
    throw new Error("Kurulum zaten tamamlanmış. İkinci çiftlik kaydı oluşturulmadı.");
  }

  const activeProfiles = await tx.first<{ count: number }>(
    "SELECT COUNT(*) AS count FROM farmer_profiles WHERE deleted_at IS NULL"
  );
  if ((activeProfiles?.count ?? 0) === 0) return;

  const userRows = await tx.first<{ count: number }>(
    `SELECT
       (SELECT COUNT(*)
          FROM transactions t
          JOIN farms f ON f.id = t.farm_id AND f.deleted_at IS NULL
          JOIN farmer_profiles p ON p.id = f.owner_local_id AND p.deleted_at IS NULL
         WHERE t.deleted_at IS NULL)
       +
       (SELECT COUNT(*)
          FROM parcels r
          JOIN farms f ON f.id = r.farm_id AND f.deleted_at IS NULL
          JOIN farmer_profiles p ON p.id = f.owner_local_id AND p.deleted_at IS NULL
         WHERE r.deleted_at IS NULL)
       AS count`
  );
  if ((userRows?.count ?? 0) > 0) {
    throw new Error("Eksik kurulumda kayıtlı veri bulundu. Otomatik düzeltme yapılmadı.");
  }

  await tx.run(
    `UPDATE farms
        SET deleted_at = ?, updated_at = ?, sync_state = 'pending'
      WHERE deleted_at IS NULL
        AND owner_local_id IN (SELECT id FROM farmer_profiles WHERE deleted_at IS NULL)`,
    [nowIso, nowIso]
  );
  await tx.run(
    `UPDATE farmer_profiles
        SET deleted_at = ?, updated_at = ?, sync_state = 'pending'
      WHERE deleted_at IS NULL`,
    [nowIso, nowIso]
  );
}

async function insertProfile(tx: SqlExecutor, profile: FarmerProfile, nowIso: string): Promise<void> {
  await tx.run(
    `INSERT INTO farmer_profiles
      (id, name, province, district, village, total_area_square_meters,
       is_cks_registered, created_at, updated_at, sync_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local')`,
    [
      profile.id,
      profile.name,
      profile.province,
      profile.district,
      profile.village,
      profile.totalAreaSquareMeters,
      profile.isCksRegistered === undefined ? null : profile.isCksRegistered ? 1 : 0,
      nowIso,
      nowIso
    ]
  );
}

function mapTransactionRow(row: TransactionRow): FarmTransaction {
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

function validateRecentLimit(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_RECENT_TRANSACTION_LIMIT) {
    throw new Error(`Son kayıt sayısı 1-${MAX_RECENT_TRANSACTION_LIMIT} arasında olmalı.`);
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

function normalizeText(value: string, field: string, min: number, max: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < min || normalized.length > max) {
    throw new Error(`${field} ${min}-${max} karakter olmalı.`);
  }
  return normalized;
}

function validateTimestamp(value: string): string {
  assertIsoUtcTimestamp(value);
  return value;
}
