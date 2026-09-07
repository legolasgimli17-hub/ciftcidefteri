import { moneyFromKurus, type MoneyKurus } from "../domain/money";
import { createFarmPartner, type FarmPartner } from "../domain/partner";
import {
  createPartnershipSettlement,
  type PartnershipSettlement
} from "../domain/partnershipSettlement";
import { assertIsoUtcTimestamp } from "../domain/date";
import { type SqlDatabase, type SqlExecutor } from "../storage/sql";

const MAX_ACTIVE_PARTNERS = 50;

export interface PartnerBalance {
  readonly partnerId: string;
  readonly partnerName: string;
  /** Positive only when this partner owes the owner. */
  readonly receivableKurus: MoneyKurus;
  /** Positive only when the owner owes this partner. */
  readonly payableKurus: MoneyKurus;
  /** receivable - payable. */
  readonly netKurus: MoneyKurus;
}

interface BalanceRow {
  partner_id: string;
  display_name: string;
  net_kurus: number;
}

interface IntegrityRow {
  invalid_transaction_count: number;
  invalid_settlement_count: number;
}

export class LocalPartnershipRepository {
  public constructor(private readonly db: SqlDatabase) {}

  public async addPartner(input: {
    readonly farmId: string;
    readonly partner: FarmPartner;
    readonly nowIso: string;
  }): Promise<void> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const partner = createFarmPartner(input.partner);
    assertIsoUtcTimestamp(input.nowIso);

    await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      const count = await tx.first<{ count: number }>(
        "SELECT COUNT(*) AS count FROM farm_partners WHERE farm_id = ? AND deleted_at IS NULL",
        [farmId]
      );
      if ((count?.count ?? 0) >= MAX_ACTIVE_PARTNERS) {
        throw new Error("En fazla 50 aktif ortak tutulabilir.");
      }

      const names = await tx.all<{ display_name: string }>(
        "SELECT display_name FROM farm_partners WHERE farm_id = ? AND deleted_at IS NULL",
        [farmId]
      );
      const targetName = normalizeComparableName(partner.name);
      if (names.some((row) => normalizeComparableName(row.display_name) === targetName)) {
        throw new Error("Bu isimde aktif bir ortak zaten var.");
      }

      await tx.run(
        `INSERT INTO farm_partners
          (id, farm_id, display_name, created_at, updated_at, sync_state)
         VALUES (?, ?, ?, ?, ?, 'local')`,
        [partner.id, farmId, partner.name, input.nowIso, input.nowIso]
      );
    });
  }

  public async listActivePartners(farmIdRaw: string): Promise<readonly FarmPartner[]> {
    const farmId = validateId(farmIdRaw, "Çiftlik kimliği");
    await assertActiveFarm(this.db, farmId);
    const rows = await this.db.all<{ id: string; display_name: string }>(
      `SELECT id, display_name
         FROM farm_partners
        WHERE farm_id = ? AND deleted_at IS NULL
        ORDER BY display_name, id
        LIMIT ?`,
      [farmId, MAX_ACTIVE_PARTNERS]
    );
    return rows.map((row) => createFarmPartner({ id: row.id, name: row.display_name }));
  }

  public async balances(farmIdRaw: string): Promise<readonly PartnerBalance[]> {
    const farmId = validateId(farmIdRaw, "Çiftlik kimliği");
    await assertActiveFarm(this.db, farmId);
    await assertPartnershipIntegrity(this.db, farmId);
    const rows = await loadBalanceRows(this.db, farmId);
    return rows.map(mapBalanceRow);
  }

  public async addSettlement(input: {
    readonly farmId: string;
    readonly settlement: PartnershipSettlement;
    readonly nowIso: string;
  }): Promise<void> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const settlement = createPartnershipSettlement(input.settlement);
    assertIsoUtcTimestamp(input.nowIso);

    await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      await assertActivePartner(tx, farmId, settlement.partnerId);
      await assertPartnershipIntegrity(tx, farmId);
      const row = await loadSingleBalanceRow(tx, farmId, settlement.partnerId);
      const currentNet = moneyFromKurus(row?.net_kurus ?? 0);

      if (settlement.direction === "partner_to_owner") {
        if (currentNet <= 0) {
          throw new Error("Bu ortaktan şu an alacağın görünmüyor.");
        }
        if (settlement.amountKurus > currentNet) {
          throw new Error("Ödeme, ortaktan alacağın açık tutarı aşıyor.");
        }
      } else {
        if (currentNet >= 0) {
          throw new Error("Bu ortağa şu an borcun görünmüyor.");
        }
        if (settlement.amountKurus > -currentNet) {
          throw new Error("Ödeme, ortağa borçlu olduğun açık tutarı aşıyor.");
        }
      }

      await tx.run(
        `INSERT INTO partner_settlements
          (id, farm_id, partner_id, amount_kurus, occurred_on, direction, note,
           created_at, updated_at, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local')`,
        [
          settlement.id,
          farmId,
          settlement.partnerId,
          settlement.amountKurus,
          settlement.occurredOn,
          settlement.direction,
          settlement.note ?? null,
          input.nowIso,
          input.nowIso
        ]
      );
    });
  }
}

async function assertPartnershipIntegrity(database: SqlExecutor, farmId: string): Promise<void> {
  const row = await database.first<IntegrityRow>(
    `SELECT
       (SELECT COUNT(*)
          FROM transaction_partnerships tp
          JOIN transactions t ON t.farm_id = tp.farm_id AND t.id = tp.transaction_id
         WHERE tp.farm_id = ?
           AND t.deleted_at IS NULL
           AND (
             typeof(t.amount_kurus) <> 'integer' OR t.amount_kurus <= 0 OR
             t.kind NOT IN ('income','expense') OR
             typeof(tp.owner_share_basis_points) <> 'integer' OR
             tp.owner_share_basis_points NOT BETWEEN 1 AND 9999 OR
             tp.cash_actor NOT IN ('owner','partner')
           )) AS invalid_transaction_count,
       (SELECT COUNT(*)
          FROM partner_settlements s
         WHERE s.farm_id = ?
           AND s.deleted_at IS NULL
           AND (
             typeof(s.amount_kurus) <> 'integer' OR s.amount_kurus <= 0 OR
             s.direction NOT IN ('partner_to_owner','owner_to_partner')
           )) AS invalid_settlement_count`,
    [farmId, farmId]
  );
  if (
    row === null ||
    row.invalid_transaction_count !== 0 ||
    row.invalid_settlement_count !== 0
  ) {
    throw new Error("Ortaklık hesabında geçersiz finans kaydı bulundu. Hesap gösterilmedi.");
  }
}

async function loadBalanceRows(database: SqlExecutor, farmId: string): Promise<readonly BalanceRow[]> {
  return database.all<BalanceRow>(balanceSql(), [farmId, farmId, farmId]);
}

async function loadSingleBalanceRow(
  database: SqlExecutor,
  farmId: string,
  partnerId: string
): Promise<BalanceRow | null> {
  const rows = await database.all<BalanceRow>(`${balanceSql()} AND p.id = ?`, [farmId, farmId, farmId, partnerId]);
  return rows[0] ?? null;
}

function balanceSql(): string {
  return `WITH transaction_impacts AS (
      SELECT tp.partner_id,
             COALESCE(SUM(
               CASE
                 WHEN t.kind = 'expense' AND tp.cash_actor = 'owner' THEN
                   t.amount_kurus - ((t.amount_kurus * tp.owner_share_basis_points + 5000) / 10000)
                 WHEN t.kind = 'expense' AND tp.cash_actor = 'partner' THEN
                   -((t.amount_kurus * tp.owner_share_basis_points + 5000) / 10000)
                 WHEN t.kind = 'income' AND tp.cash_actor = 'owner' THEN
                   -(t.amount_kurus - ((t.amount_kurus * tp.owner_share_basis_points + 5000) / 10000))
                 WHEN t.kind = 'income' AND tp.cash_actor = 'partner' THEN
                   ((t.amount_kurus * tp.owner_share_basis_points + 5000) / 10000)
                 ELSE 0
               END
             ), 0) AS net_kurus
        FROM transaction_partnerships tp
        JOIN transactions t ON t.farm_id = tp.farm_id AND t.id = tp.transaction_id
       WHERE tp.farm_id = ? AND t.deleted_at IS NULL
       GROUP BY tp.partner_id
    ), settlement_impacts AS (
      SELECT partner_id,
             COALESCE(SUM(
               CASE direction
                 WHEN 'owner_to_partner' THEN amount_kurus
                 WHEN 'partner_to_owner' THEN -amount_kurus
                 ELSE 0
               END
             ), 0) AS net_kurus
        FROM partner_settlements
       WHERE farm_id = ? AND deleted_at IS NULL
       GROUP BY partner_id
    )
    SELECT p.id AS partner_id,
           p.display_name,
           COALESCE(ti.net_kurus, 0) + COALESCE(si.net_kurus, 0) AS net_kurus
      FROM farm_partners p
      LEFT JOIN transaction_impacts ti ON ti.partner_id = p.id
      LEFT JOIN settlement_impacts si ON si.partner_id = p.id
     WHERE p.farm_id = ?`;
}

function mapBalanceRow(row: BalanceRow): PartnerBalance {
  const netKurus = moneyFromKurus(row.net_kurus);
  return {
    partnerId: validateId(row.partner_id, "Ortak kimliği"),
    partnerName: createFarmPartner({ id: row.partner_id, name: row.display_name }).name,
    receivableKurus: moneyFromKurus(Math.max(netKurus, 0)),
    payableKurus: moneyFromKurus(Math.max(-netKurus, 0)),
    netKurus
  };
}

async function assertActiveFarm(database: SqlExecutor, farmId: string): Promise<void> {
  const row = await database.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM farms f
       JOIN farmer_profiles p ON p.id = f.owner_local_id
      WHERE f.id = ? AND f.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [farmId]
  );
  if ((row?.count ?? 0) !== 1) {
    throw new Error("Bu çiftlik aktif değil. Ortaklık hesabı değiştirilmedi.");
  }
}

async function assertActivePartner(database: SqlExecutor, farmId: string, partnerId: string): Promise<void> {
  const row = await database.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM farm_partners
      WHERE farm_id = ? AND id = ? AND deleted_at IS NULL`,
    [farmId, partnerId]
  );
  if ((row?.count ?? 0) !== 1) {
    throw new Error("Bu ortak aktif değil. İşlem yapılmadı.");
  }
}

function normalizeComparableName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) {
    throw new Error(`${field} geçersiz.`);
  }
  return normalized;
}
