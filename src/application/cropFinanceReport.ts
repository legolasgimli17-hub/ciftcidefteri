import { cropTemplates, parseCropCode, type CropCode } from "../domain/crops";
import { addMoney, moneyFromKurus, subtractMoney, type MoneyKurus } from "../domain/money";
import { type SqlDatabase } from "../storage/sql";
import { loadFarmIdentity } from "./appSnapshot";

interface CropAggregateRow {
  crop_code: string | null;
  income_kurus: number;
  expense_kurus: number;
  invalid_kind_count: number;
  invalid_amount_count: number;
  invalid_support_boolean_count: number;
  invalid_support_scope_count: number;
}

export interface FinanceAmounts {
  readonly incomeKurus: MoneyKurus;
  readonly expenseKurus: MoneyKurus;
  readonly netKurus: MoneyKurus;
}

export interface CropFinanceRow extends FinanceAmounts {
  readonly key: string;
  readonly label: string;
  readonly cropCode?: CropCode;
  readonly isHistorical: boolean;
}

export interface CropFinanceReport {
  readonly farmId: string;
  readonly overall: FinanceAmounts;
  readonly rows: readonly CropFinanceRow[];
}

export async function loadCropFinanceReport(db: SqlDatabase): Promise<CropFinanceReport | null> {
  const identity = await loadFarmIdentity(db);
  if (identity === null) return null;

  const aggregateRows = await db.all<CropAggregateRow>(
    `SELECT
       crop_code,
       COALESCE(SUM(CASE WHEN kind = 'income' THEN amount_kurus ELSE 0 END), 0) AS income_kurus,
       COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_kurus ELSE 0 END), 0) AS expense_kurus,
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
     WHERE farm_id = ? AND deleted_at IS NULL
     GROUP BY crop_code
     ORDER BY crop_code ASC`,
    [identity.farmId]
  );

  const selectedCrops = new Set<CropCode>(identity.cropCodes);
  const byCrop = new Map<CropCode, FinanceAmounts>();
  let general: FinanceAmounts | undefined;
  let overall = zeroAmounts();

  for (const row of aggregateRows) {
    assertValidAggregateRow(row);
    const amounts = amountsFromRow(row);
    overall = addAmounts(overall, amounts);

    if (row.crop_code === null) {
      general = amounts;
      continue;
    }

    const cropCode = parseCropCode(row.crop_code);
    if (byCrop.has(cropCode)) {
      throw new Error("Yerel finans verisinde aynı ürün için birden fazla özet satırı bulundu.");
    }
    byCrop.set(cropCode, amounts);
  }

  const rows: CropFinanceRow[] = identity.cropCodes.map((cropCode) => ({
    key: `crop:${cropCode}`,
    label: cropTemplates[cropCode].label,
    cropCode,
    isHistorical: false,
    ...(byCrop.get(cropCode) ?? zeroAmounts())
  }));

  if (general !== undefined) {
    rows.push({
      key: "general",
      label: "Genel kayıtlar",
      isHistorical: false,
      ...general
    });
  }

  const historicalRows = [...byCrop.entries()]
    .filter(([cropCode]) => !selectedCrops.has(cropCode))
    .sort(([left], [right]) => cropTemplates[left].label.localeCompare(cropTemplates[right].label, "tr"))
    .map(([cropCode, amounts]): CropFinanceRow => ({
      key: `historical:${cropCode}`,
      label: `${cropTemplates[cropCode].label} · eski kayıtlar`,
      cropCode,
      isHistorical: true,
      ...amounts
    }));

  rows.push(...historicalRows);

  return {
    farmId: identity.farmId,
    overall,
    rows
  };
}

function assertValidAggregateRow(row: CropAggregateRow): void {
  if (
    row.invalid_kind_count !== 0 ||
    row.invalid_amount_count !== 0 ||
    row.invalid_support_boolean_count !== 0 ||
    row.invalid_support_scope_count !== 0
  ) {
    throw new Error("Yerel finans verisinde geçersiz kayıt bulundu. Ürün özeti gösterilmedi.");
  }
}

function amountsFromRow(row: Pick<CropAggregateRow, "income_kurus" | "expense_kurus">): FinanceAmounts {
  const incomeKurus = moneyFromKurus(row.income_kurus);
  const expenseKurus = moneyFromKurus(row.expense_kurus);
  return {
    incomeKurus,
    expenseKurus,
    netKurus: subtractMoney(incomeKurus, expenseKurus)
  };
}

function zeroAmounts(): FinanceAmounts {
  const zero = moneyFromKurus(0);
  return { incomeKurus: zero, expenseKurus: zero, netKurus: zero };
}

function addAmounts(left: FinanceAmounts, right: FinanceAmounts): FinanceAmounts {
  const incomeKurus = addMoney(left.incomeKurus, right.incomeKurus);
  const expenseKurus = addMoney(left.expenseKurus, right.expenseKurus);
  return {
    incomeKurus,
    expenseKurus,
    netKurus: subtractMoney(incomeKurus, expenseKurus)
  };
}
