import { assertIsoUtcTimestamp } from "../domain/date";
import {
  createInventoryItem,
  createInventoryMovement,
  parseInventoryItemKind,
  parseInventoryMovementKind,
  parseInventoryUnit,
  positiveQuantityMilliFromStored,
  quantityMilliFromStored,
  type InventoryItem,
  type InventoryMovement,
  type InventoryQuantityMilli
} from "../domain/inventory";
import { type SqlDatabase, type SqlExecutor } from "../storage/sql";

const MAX_ACTIVE_ITEMS = 200;
const MAX_DETAIL_MOVEMENTS = 1000;

export interface InventoryBalance {
  readonly item: InventoryItem;
  readonly remainingQuantityMilli: InventoryQuantityMilli;
}

export interface InventoryDetail {
  readonly balance: InventoryBalance;
  readonly movements: readonly InventoryMovement[];
}

export class LocalInventoryRepository {
  public constructor(private readonly db: SqlDatabase) {}

  public async addItemWithOpening(input: {
    readonly farmId: string;
    readonly item: InventoryItem;
    readonly openingMovement: InventoryMovement;
    readonly nowIso: string;
  }): Promise<void> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    assertIsoUtcTimestamp(input.nowIso);
    if (input.openingMovement.itemId !== input.item.id || input.openingMovement.kind !== "increase") {
      throw new Error("İlk miktar bu kaleme ait bir ekleme hareketi olmalı.");
    }

    await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      const duplicate = await tx.first<{ count: number }>(
        `SELECT COUNT(*) AS count
           FROM inventory_items
          WHERE farm_id = ? AND display_name = ? COLLATE NOCASE AND unit_code = ? AND deleted_at IS NULL`,
        [farmId, input.item.name, input.item.unit]
      );
      if ((duplicate?.count ?? 0) !== 0) {
        throw new Error("Bu ad ve birimde aktif bir kayıt zaten var.");
      }

      await tx.run(
        `INSERT INTO inventory_items
          (id,farm_id,item_kind,display_name,unit_code,created_at,updated_at,sync_state)
         VALUES (?,?,?,?,?,?,?,'local')`,
        [input.item.id, farmId, input.item.kind, input.item.name, input.item.unit, input.nowIso, input.nowIso]
      );
      await insertMovement(tx, farmId, input.openingMovement, input.nowIso);
    });
  }

  public async listBalances(farmIdRaw: string): Promise<readonly InventoryBalance[]> {
    const farmId = validateId(farmIdRaw, "Çiftlik kimliği");
    await assertActiveFarm(this.db, farmId);

    const orphan = await this.db.first<{ count: number }>(
      `SELECT COUNT(*) AS count
         FROM inventory_movements m
         JOIN inventory_items i ON i.farm_id = m.farm_id AND i.id = m.item_id
        WHERE m.farm_id = ? AND m.deleted_at IS NULL AND i.deleted_at IS NOT NULL`,
      [farmId]
    );
    if ((orphan?.count ?? 0) !== 0) {
      throw new Error("Aktif hareketi olan pasif kalem bulundu.");
    }

    const rows = await this.db.all<{
      id: string;
      item_kind: string;
      display_name: string;
      unit_code: string;
      remaining_quantity_milli: number;
      movement_count: number;
      invalid_movement_kind_count: number;
      invalid_quantity_count: number;
    }>(
      `SELECT i.id, i.item_kind, i.display_name, i.unit_code,
              COALESCE(SUM(CASE
                WHEN m.kind = 'increase' THEN m.quantity_milli
                WHEN m.kind = 'decrease' THEN -m.quantity_milli
                ELSE 0 END), 0) AS remaining_quantity_milli,
              COUNT(m.id) AS movement_count,
              COALESCE(SUM(CASE WHEN m.id IS NOT NULL AND m.kind NOT IN ('increase','decrease') THEN 1 ELSE 0 END), 0) AS invalid_movement_kind_count,
              COALESCE(SUM(CASE WHEN m.id IS NOT NULL AND (m.quantity_milli <= 0 OR m.quantity_milli > ?) THEN 1 ELSE 0 END), 0) AS invalid_quantity_count
         FROM inventory_items i
         LEFT JOIN inventory_movements m
           ON m.farm_id = i.farm_id AND m.item_id = i.id AND m.deleted_at IS NULL
        WHERE i.farm_id = ? AND i.deleted_at IS NULL
        GROUP BY i.id, i.item_kind, i.display_name, i.unit_code
        ORDER BY i.display_name COLLATE NOCASE, i.id
        LIMIT ?`,
      [9_000_000_000_000, farmId, MAX_ACTIVE_ITEMS + 1]
    );
    if (rows.length > MAX_ACTIVE_ITEMS) throw new Error("Elindekiler listesi güvenli okuma sınırını aşıyor.");

    return rows.map((row) => {
      if (row.invalid_movement_kind_count !== 0 || row.invalid_quantity_count !== 0) {
        throw new Error("Elindekiler verisinde bozuk hareket bulundu.");
      }
      const remainingQuantityMilli = quantityMilliFromStored(row.remaining_quantity_milli);
      const item = createInventoryItem({
        id: row.id,
        kind: parseInventoryItemKind(row.item_kind),
        name: row.display_name,
        unit: parseInventoryUnit(row.unit_code)
      });
      return { item, remainingQuantityMilli };
    });
  }

  public async load(farmIdRaw: string, itemIdRaw: string): Promise<InventoryDetail> {
    const farmId = validateId(farmIdRaw, "Çiftlik kimliği");
    const itemId = validateId(itemIdRaw, "Kalem kimliği");
    const balance = (await this.listBalances(farmId)).find((entry) => entry.item.id === itemId);
    if (balance === undefined) throw new Error("Bu kayıt bulunamadı.");

    const rows = await this.db.all<{
      id: string;
      kind: string;
      quantity_milli: number;
      occurred_on: string;
      note: string | null;
    }>(
      `SELECT id, kind, quantity_milli, occurred_on, note
         FROM inventory_movements
        WHERE farm_id = ? AND item_id = ? AND deleted_at IS NULL
        ORDER BY occurred_on DESC, created_at DESC, id DESC
        LIMIT ?`,
      [farmId, itemId, MAX_DETAIL_MOVEMENTS + 1]
    );
    if (rows.length > MAX_DETAIL_MOVEMENTS) throw new Error("Hareket geçmişi güvenli okuma sınırını aşıyor.");

    return {
      balance,
      movements: rows.map((row) => createInventoryMovement({
        id: row.id,
        itemId,
        kind: parseInventoryMovementKind(row.kind),
        quantityMilli: positiveQuantityMilliFromStored(row.quantity_milli),
        occurredOn: row.occurred_on,
        ...(row.note === null ? {} : { note: row.note })
      }))
    };
  }

  public async addMovement(input: {
    readonly farmId: string;
    readonly movement: InventoryMovement;
    readonly nowIso: string;
  }): Promise<void> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    assertIsoUtcTimestamp(input.nowIso);

    await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      await assertActiveItem(tx, farmId, input.movement.itemId);
      const current = await loadRemainingQuantity(tx, farmId, input.movement.itemId);
      const next = input.movement.kind === "increase"
        ? current + input.movement.quantityMilli
        : current - input.movement.quantityMilli;
      quantityMilliFromStored(next);
      await insertMovement(tx, farmId, input.movement, input.nowIso);
    });
  }

  public async softDeleteMovement(input: {
    readonly farmId: string;
    readonly itemId: string;
    readonly movementId: string;
    readonly nowIso: string;
  }): Promise<boolean> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const itemId = validateId(input.itemId, "Kalem kimliği");
    const movementId = validateId(input.movementId, "Hareket kimliği");
    assertIsoUtcTimestamp(input.nowIso);

    return this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      await assertActiveItem(tx, farmId, itemId);
      const row = await tx.first<{ kind: string; quantity_milli: number }>(
        `SELECT kind, quantity_milli
           FROM inventory_movements
          WHERE farm_id = ? AND item_id = ? AND id = ? AND deleted_at IS NULL`,
        [farmId, itemId, movementId]
      );
      if (row === null) return false;
      const kind = parseInventoryMovementKind(row.kind);
      const quantity = positiveQuantityMilliFromStored(row.quantity_milli);
      const current = await loadRemainingQuantity(tx, farmId, itemId);
      const afterRemoval = kind === "increase" ? current - quantity : current + quantity;
      quantityMilliFromStored(afterRemoval);

      const result = await tx.run(
        `UPDATE inventory_movements
            SET deleted_at = ?, updated_at = ?, sync_state = 'local'
          WHERE farm_id = ? AND item_id = ? AND id = ? AND deleted_at IS NULL`,
        [input.nowIso, input.nowIso, farmId, itemId, movementId]
      );
      return result.changes === 1;
    });
  }

  public async restoreMovement(input: {
    readonly farmId: string;
    readonly itemId: string;
    readonly movementId: string;
    readonly nowIso: string;
  }): Promise<boolean> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const itemId = validateId(input.itemId, "Kalem kimliği");
    const movementId = validateId(input.movementId, "Hareket kimliği");
    assertIsoUtcTimestamp(input.nowIso);

    return this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      await assertActiveItem(tx, farmId, itemId);
      const row = await tx.first<{ kind: string; quantity_milli: number }>(
        `SELECT kind, quantity_milli
           FROM inventory_movements
          WHERE farm_id = ? AND item_id = ? AND id = ? AND deleted_at IS NOT NULL`,
        [farmId, itemId, movementId]
      );
      if (row === null) return false;
      const kind = parseInventoryMovementKind(row.kind);
      const quantity = positiveQuantityMilliFromStored(row.quantity_milli);
      const current = await loadRemainingQuantity(tx, farmId, itemId);
      const afterRestore = kind === "increase" ? current + quantity : current - quantity;
      quantityMilliFromStored(afterRestore);

      const result = await tx.run(
        `UPDATE inventory_movements
            SET deleted_at = NULL, updated_at = ?, sync_state = 'local'
          WHERE farm_id = ? AND item_id = ? AND id = ? AND deleted_at IS NOT NULL`,
        [input.nowIso, farmId, itemId, movementId]
      );
      return result.changes === 1;
    });
  }

  public async deleteItemWithoutMovements(input: {
    readonly farmId: string;
    readonly itemId: string;
    readonly nowIso: string;
  }): Promise<void> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const itemId = validateId(input.itemId, "Kalem kimliği");
    assertIsoUtcTimestamp(input.nowIso);

    await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      await assertActiveItem(tx, farmId, itemId);
      const movements = await tx.first<{ count: number }>(
        `SELECT COUNT(*) AS count
           FROM inventory_movements
          WHERE farm_id = ? AND item_id = ? AND deleted_at IS NULL`,
        [farmId, itemId]
      );
      if ((movements?.count ?? 0) !== 0) throw new Error("Aktif hareketi olan kayıt doğrudan silinemez.");
      const result = await tx.run(
        `UPDATE inventory_items
            SET deleted_at = ?, updated_at = ?, sync_state = 'local'
          WHERE farm_id = ? AND id = ? AND deleted_at IS NULL`,
        [input.nowIso, input.nowIso, farmId, itemId]
      );
      if (result.changes !== 1) throw new Error("Kayıt silinemedi.");
    });
  }
}

async function insertMovement(
  tx: SqlExecutor,
  farmId: string,
  movement: InventoryMovement,
  nowIso: string
): Promise<void> {
  await tx.run(
    `INSERT INTO inventory_movements
      (id,farm_id,item_id,kind,quantity_milli,occurred_on,note,created_at,updated_at,sync_state)
     VALUES (?,?,?,?,?,?,?,?,?,'local')`,
    [
      movement.id,
      farmId,
      movement.itemId,
      movement.kind,
      movement.quantityMilli,
      movement.occurredOn,
      movement.note ?? null,
      nowIso,
      nowIso
    ]
  );
}

async function loadRemainingQuantity(tx: SqlExecutor, farmId: string, itemId: string): Promise<InventoryQuantityMilli> {
  const row = await tx.first<{ remaining: number; invalid_count: number }>(
    `SELECT COALESCE(SUM(CASE
              WHEN kind = 'increase' THEN quantity_milli
              WHEN kind = 'decrease' THEN -quantity_milli
              ELSE 0 END), 0) AS remaining,
            COALESCE(SUM(CASE
              WHEN kind NOT IN ('increase','decrease') OR quantity_milli <= 0 OR quantity_milli > ? THEN 1 ELSE 0 END), 0) AS invalid_count
       FROM inventory_movements
      WHERE farm_id = ? AND item_id = ? AND deleted_at IS NULL`,
    [9_000_000_000_000, farmId, itemId]
  );
  if ((row?.invalid_count ?? 0) !== 0) throw new Error("Elindekiler verisinde bozuk hareket bulundu.");
  return quantityMilliFromStored(row?.remaining ?? 0);
}

async function assertActiveFarm(tx: SqlExecutor, farmId: string): Promise<void> {
  const row = await tx.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM farms f
       JOIN farmer_profiles p ON p.id = f.owner_local_id
      WHERE f.id = ? AND f.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [farmId]
  );
  if ((row?.count ?? 0) !== 1) throw new Error("Bu çiftlik aktif değil.");
}

async function assertActiveItem(tx: SqlExecutor, farmId: string, itemId: string): Promise<void> {
  const row = await tx.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM inventory_items
      WHERE farm_id = ? AND id = ? AND deleted_at IS NULL`,
    [farmId, itemId]
  );
  if ((row?.count ?? 0) !== 1) throw new Error("Bu kayıt aktif değil.");
}

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) throw new Error(`${field} geçersiz.`);
  return normalized;
}
