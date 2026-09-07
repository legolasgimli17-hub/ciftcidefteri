import { type SqlDatabase } from "../storage/sql";

interface CategoryRow {
  category: string;
}

const MAX_FILTER_CATEGORIES = 80;

export async function loadLedgerCategoryOptions(
  db: SqlDatabase,
  farmIdRaw: string
): Promise<readonly string[]> {
  const farmId = validateId(farmIdRaw, "Çiftlik kimliği");
  const active = await db.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM farms f
       JOIN farmer_profiles p ON p.id = f.owner_local_id
      WHERE f.id = ? AND f.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [farmId]
  );
  if ((active?.count ?? 0) !== 1) throw new Error("Çiftlik aktif değil. Filtre seçenekleri açılmadı.");

  const rows = await db.all<CategoryRow>(
    `SELECT category
       FROM transactions
      WHERE farm_id = ? AND deleted_at IS NULL
      GROUP BY category
      ORDER BY category COLLATE NOCASE ASC
      LIMIT ?`,
    [farmId, MAX_FILTER_CATEGORIES]
  );

  return rows.map((row) => normalizeCategory(row.category));
}

function normalizeCategory(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 1 || normalized.length > 60) {
    throw new Error("Defterde geçersiz kategori bulundu. Filtre seçenekleri gösterilmedi.");
  }
  return normalized;
}

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) throw new Error(`${field} geçersiz.`);
  return normalized;
}
