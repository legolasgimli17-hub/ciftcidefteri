import { createFarmPartner } from "../domain/partner";
import { BASIS_POINTS_TOTAL, type PartnershipCashActor } from "../domain/partnership";
import { type SqlDatabase } from "../storage/sql";

export interface LedgerPartnershipDetail {
  readonly transactionId: string;
  readonly partnerId: string;
  readonly partnerName: string;
  readonly ownerShareBasisPoints: number;
  readonly partnerShareBasisPoints: number;
  readonly cashActor: PartnershipCashActor;
}

interface StoredLedgerPartnershipRow {
  transaction_id: string;
  partner_id: string;
  display_name: string;
  owner_share_basis_points: number;
  cash_actor: string;
}

const MAX_LEDGER_DETAIL_IDS = 40;

export async function loadLedgerPartnershipDetails(
  db: SqlDatabase,
  farmIdRaw: string,
  transactionIdsRaw: readonly string[]
): Promise<ReadonlyMap<string, LedgerPartnershipDetail>> {
  const farmId = validateId(farmIdRaw, "Çiftlik kimliği");
  const transactionIds = [...new Set(transactionIdsRaw.map((id) => validateId(id, "İşlem kimliği")))];
  if (transactionIds.length === 0) return new Map();
  if (transactionIds.length > MAX_LEDGER_DETAIL_IDS) {
    throw new Error(`Bir defada en fazla ${MAX_LEDGER_DETAIL_IDS} kayıt ayrıntısı okunabilir.`);
  }

  const placeholders = transactionIds.map(() => "?").join(",");
  const rows = await db.all<StoredLedgerPartnershipRow>(
    `SELECT tp.transaction_id, tp.partner_id, p.display_name,
            tp.owner_share_basis_points, tp.cash_actor
       FROM transaction_partnerships tp
       JOIN transactions t
         ON t.farm_id = tp.farm_id AND t.id = tp.transaction_id
       JOIN farm_partners p
         ON p.farm_id = tp.farm_id AND p.id = tp.partner_id
      WHERE tp.farm_id = ?
        AND t.deleted_at IS NULL
        AND tp.transaction_id IN (${placeholders})`,
    [farmId, ...transactionIds]
  );

  const result = new Map<string, LedgerPartnershipDetail>();
  for (const row of rows) {
    const transactionId = validateId(row.transaction_id, "İşlem kimliği");
    if (!Number.isSafeInteger(row.owner_share_basis_points) || row.owner_share_basis_points <= 0 || row.owner_share_basis_points >= BASIS_POINTS_TOTAL) {
      throw new Error("Ortaklık payı bozuk. Defter ayrıntısı gösterilmedi.");
    }
    if (row.cash_actor !== "owner" && row.cash_actor !== "partner") {
      throw new Error("Ortaklık ödeme bilgisi bozuk. Defter ayrıntısı gösterilmedi.");
    }
    if (result.has(transactionId)) {
      throw new Error("Bir işlem için birden fazla ortaklık kaydı bulundu. Defter ayrıntısı gösterilmedi.");
    }
    const partner = createFarmPartner({ id: row.partner_id, name: row.display_name });
    result.set(transactionId, {
      transactionId,
      partnerId: partner.id,
      partnerName: partner.name,
      ownerShareBasisPoints: row.owner_share_basis_points,
      partnerShareBasisPoints: BASIS_POINTS_TOTAL - row.owner_share_basis_points,
      cashActor: row.cash_actor
    });
  }

  return result;
}

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) {
    throw new Error(`${field} geçersiz.`);
  }
  return normalized;
}
