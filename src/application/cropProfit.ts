import { cropTemplates, parseCropCode, type CropCode } from "../domain/crops";
import { moneyFromKurus } from "../domain/money";
import { createProfitLossSummary, type ProfitLossSummary } from "../domain/profitLoss";
import { type SqlDatabase } from "../storage/sql";

export interface CropProfitSummary {
  readonly cropCode: CropCode;
  readonly cropLabel: string;
  readonly summary: ProfitLossSummary;
}

interface CropProfitRow {
  crop_code: string;
  income_kurus: number;
  expense_kurus: number;
  tax_exempt_support_kurus: number;
  invalid_kind_count: number;
  invalid_amount_count: number;
  invalid_support_boolean_count: number;
  invalid_support_scope_count: number;
}

export async function loadCropProfitSummaries(
  db: SqlDatabase,
  farmIdRaw: string
): Promise<readonly CropProfitSummary[]> {
  const farmId = validateId(farmIdRaw);

  const activeFarm = await db.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM farms f
       JOIN farmer_profiles p ON p.id = f.owner_local_id
      WHERE f.id = ? AND f.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [farmId]
  );
  if ((activeFarm?.count ?? 0) !== 1) {
    throw new Error("Bu çiftlik aktif değil. Ürün özeti gösterilmedi.");
  }

  const orphaned = await db.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM transactions t
       LEFT JOIN farm_crops c
         ON c.farm_id = t.farm_id
        AND c.crop_code = t.crop_code
        AND c.deleted_at IS NULL
      WHERE t.farm_id = ?
        AND t.deleted_at IS NULL
        AND t.crop_code IS NOT NULL
        AND c.crop_code IS NULL`,
    [farmId]
  );
  if ((orphaned?.count ?? 0) !== 0) {
    throw new Error("Ürüne bağlı bir kayıt güvenle eşleştirilemedi. Ürün özeti gösterilmedi.");
  }

  const rows = await db.all<CropProfitRow>(
    `SELECT
       c.crop_code,
       COALESCE(SUM(CASE WHEN t.kind = 'income' THEN t.amount_kurus ELSE 0 END), 0) AS income_kurus,
       COALESCE(SUM(CASE WHEN t.kind = 'expense' THEN t.amount_kurus ELSE 0 END), 0) AS expense_kurus,
       COALESCE(SUM(CASE
         WHEN t.kind = 'income' AND t.is_tax_exempt_support = 1 THEN t.amount_kurus ELSE 0 END), 0)
         AS tax_exempt_support_kurus,
       COALESCE(SUM(CASE
         WHEN t.id IS NOT NULL AND (t.kind IS NULL OR t.kind NOT IN ('income','expense')) THEN 1 ELSE 0 END), 0)
         AS invalid_kind_count,
       COALESCE(SUM(CASE
         WHEN t.id IS NOT NULL AND (typeof(t.amount_kurus) <> 'integer' OR t.amount_kurus <= 0) THEN 1 ELSE 0 END), 0)
         AS invalid_amount_count,
       COALESCE(SUM(CASE
         WHEN t.id IS NOT NULL AND (t.is_tax_exempt_support IS NULL OR t.is_tax_exempt_support NOT IN (0,1))
         THEN 1 ELSE 0 END), 0)
         AS invalid_support_boolean_count,
       COALESCE(SUM(CASE
         WHEN t.id IS NOT NULL AND t.is_tax_exempt_support = 1 AND t.kind <> 'income' THEN 1 ELSE 0 END), 0)
         AS invalid_support_scope_count
     FROM farm_crops c
     LEFT JOIN transactions t
       ON t.farm_id = c.farm_id
      AND t.crop_code = c.crop_code
      AND t.deleted_at IS NULL
    WHERE c.farm_id = ? AND c.deleted_at IS NULL
    GROUP BY c.crop_code, c.created_at
    ORDER BY c.created_at ASC, c.crop_code ASC`,
    [farmId]
  );

  return rows.map((row) => {
    if (
      row.invalid_kind_count !== 0 ||
      row.invalid_amount_count !== 0 ||
      row.invalid_support_boolean_count !== 0 ||
      row.invalid_support_scope_count !== 0
    ) {
      throw new Error("Yerel finans verisinde geçersiz kayıt bulundu. Ürün özeti gösterilmedi.");
    }

    const cropCode = parseCropCode(row.crop_code);
    return {
      cropCode,
      cropLabel: cropTemplates[cropCode].label,
      summary: createProfitLossSummary({
        incomeKurus: moneyFromKurus(row.income_kurus),
        expenseKurus: moneyFromKurus(row.expense_kurus),
        taxExemptSupportIncomeKurus: moneyFromKurus(row.tax_exempt_support_kurus)
      })
    };
  });
}

function validateId(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) {
    throw new Error("Çiftlik kimliği geçersiz.");
  }
  return normalized;
}
