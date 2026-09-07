import { LocalDebtRepository, type DebtBalance } from "./localDebtRepository";
import { createDebtInstallment, createDebtPayment, type DebtInstallment, type DebtPayment } from "../domain/debt";
import { assertIsoUtcTimestamp } from "../domain/date";
import { type SqlDatabase, type SqlExecutor } from "../storage/sql";

const MAX_DETAIL_INSTALLMENTS = 120;
const MAX_DETAIL_PAYMENTS = 1000;

export interface DebtDetail {
  readonly balance: DebtBalance;
  readonly installments: readonly DebtInstallment[];
  readonly payments: readonly DebtPayment[];
}

export class LocalDebtDetailsRepository {
  public constructor(private readonly db: SqlDatabase) {}

  public async load(farmIdRaw: string, debtIdRaw: string): Promise<DebtDetail> {
    const farmId = validateId(farmIdRaw, "Çiftlik kimliği");
    const debtId = validateId(debtIdRaw, "Borç kimliği");
    const balance = (await new LocalDebtRepository(this.db).listBalances(farmId))
      .find((item) => item.debt.id === debtId);
    if (balance === undefined) {
      throw new Error("Bu borç bulunamadı.");
    }

    const installmentRows = await this.db.all<{
      id: string;
      due_on: string;
      amount_kurus: number;
    }>(
      `SELECT id, due_on, amount_kurus
         FROM debt_installments
        WHERE farm_id = ? AND debt_id = ? AND deleted_at IS NULL
        ORDER BY due_on, id
        LIMIT ?`,
      [farmId, debtId, MAX_DETAIL_INSTALLMENTS + 1]
    );
    if (installmentRows.length > MAX_DETAIL_INSTALLMENTS) {
      throw new Error("Ödeme planı güvenli okuma sınırını aşıyor.");
    }

    const paymentRows = await this.db.all<{
      id: string;
      amount_kurus: number;
      occurred_on: string;
      note: string | null;
    }>(
      `SELECT id, amount_kurus, occurred_on, note
         FROM debt_payments
        WHERE farm_id = ? AND debt_id = ? AND deleted_at IS NULL
        ORDER BY occurred_on DESC, created_at DESC, id DESC
        LIMIT ?`,
      [farmId, debtId, MAX_DETAIL_PAYMENTS + 1]
    );
    if (paymentRows.length > MAX_DETAIL_PAYMENTS) {
      throw new Error("Ödeme geçmişi güvenli okuma sınırını aşıyor.");
    }

    const installments = installmentRows.map((row) => createDebtInstallment({
      id: row.id,
      dueOn: row.due_on,
      amountKurus: row.amount_kurus
    }));
    const payments = paymentRows.map((row) => createDebtPayment({
      id: row.id,
      amountKurus: row.amount_kurus,
      occurredOn: row.occurred_on,
      ...(row.note === null ? {} : { note: row.note })
    }));

    return { balance, installments, payments };
  }

  public async reversePayment(input: {
    readonly farmId: string;
    readonly debtId: string;
    readonly paymentId: string;
    readonly nowIso: string;
  }): Promise<void> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const debtId = validateId(input.debtId, "Borç kimliği");
    const paymentId = validateId(input.paymentId, "Ödeme kimliği");
    assertIsoUtcTimestamp(input.nowIso);

    await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      await assertActiveDebt(tx, farmId, debtId);
      const payment = await tx.first<{ count: number }>(
        `SELECT COUNT(*) AS count
           FROM debt_payments
          WHERE farm_id = ? AND debt_id = ? AND id = ? AND deleted_at IS NULL`,
        [farmId, debtId, paymentId]
      );
      if ((payment?.count ?? 0) !== 1) {
        throw new Error("Bu ödeme kaydı aktif değil.");
      }

      const result = await tx.run(
        `UPDATE debt_payments
            SET deleted_at = ?, updated_at = ?, sync_state = 'local'
          WHERE farm_id = ? AND debt_id = ? AND id = ? AND deleted_at IS NULL`,
        [input.nowIso, input.nowIso, farmId, debtId, paymentId]
      );
      if (result.changes !== 1) {
        throw new Error("Ödeme geri alınamadı.");
      }
    });
  }

  public async deleteDebtWithoutPayments(input: {
    readonly farmId: string;
    readonly debtId: string;
    readonly nowIso: string;
  }): Promise<void> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const debtId = validateId(input.debtId, "Borç kimliği");
    assertIsoUtcTimestamp(input.nowIso);

    await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      await assertActiveDebt(tx, farmId, debtId);
      const payments = await tx.first<{ count: number }>(
        `SELECT COUNT(*) AS count
           FROM debt_payments
          WHERE farm_id = ? AND debt_id = ? AND deleted_at IS NULL`,
        [farmId, debtId]
      );
      if ((payments?.count ?? 0) !== 0) {
        throw new Error("Aktif ödeme kaydı olan borç doğrudan silinemez.");
      }

      await tx.run(
        `UPDATE debt_installments
            SET deleted_at = ?, updated_at = ?, sync_state = 'local'
          WHERE farm_id = ? AND debt_id = ? AND deleted_at IS NULL`,
        [input.nowIso, input.nowIso, farmId, debtId]
      );
      const result = await tx.run(
        `UPDATE debts
            SET deleted_at = ?, updated_at = ?, sync_state = 'local'
          WHERE farm_id = ? AND id = ? AND deleted_at IS NULL`,
        [input.nowIso, input.nowIso, farmId, debtId]
      );
      if (result.changes !== 1) {
        throw new Error("Borç kaydı silinemedi.");
      }
    });
  }
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
    throw new Error("Bu çiftlik aktif değil.");
  }
}

async function assertActiveDebt(database: SqlExecutor, farmId: string, debtId: string): Promise<void> {
  const row = await database.first<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM debts
      WHERE farm_id = ? AND id = ? AND deleted_at IS NULL`,
    [farmId, debtId]
  );
  if ((row?.count ?? 0) !== 1) {
    throw new Error("Bu borç aktif değil.");
  }
}

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) {
    throw new Error(`${field} geçersiz.`);
  }
  return normalized;
}
