import {
  createDebtInstallment,
  createDebtPayment,
  createFarmDebt,
  parseDebtSourceKind,
  type DebtInstallment,
  type DebtPayment,
  type FarmDebt
} from "../domain/debt";
import { assertIsoUtcTimestamp } from "../domain/date";
import { moneyFromKurus, type MoneyKurus } from "../domain/money";
import { type SqlDatabase, type SqlExecutor } from "../storage/sql";

const MAX_ACTIVE_DEBTS = 100;
const MAX_INSTALLMENTS_PER_DEBT = 120;
const MAX_PAYMENTS_PER_DEBT = 1000;

export interface DebtBalance {
  readonly debt: FarmDebt;
  readonly paidKurus: MoneyKurus;
  readonly remainingKurus: MoneyKurus;
  readonly installmentCount: number;
  readonly paymentCount: number;
  readonly nextDueOn?: string;
  readonly nextDueAmountKurus?: MoneyKurus;
}

interface StoredDebtRow {
  id: string;
  source_kind: string;
  creditor_name: string;
  total_kurus: number;
  opened_on: string;
  in_kind_description: string | null;
  note: string | null;
}

interface StoredInstallmentRow {
  id: string;
  debt_id: string;
  due_on: string;
  amount_kurus: number;
}

interface PaymentAggregateRow {
  debt_id: string;
  paid_kurus: number;
  payment_count: number;
}

export class LocalDebtRepository {
  public constructor(private readonly db: SqlDatabase) {}

  public async addDebt(input: {
    readonly farmId: string;
    readonly debt: FarmDebt;
    readonly installments: readonly DebtInstallment[];
    readonly nowIso: string;
  }): Promise<void> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const debt = createFarmDebt(input.debt);
    const installments = input.installments.map((item) => createDebtInstallment(item));
    assertIsoUtcTimestamp(input.nowIso);
    assertInstallmentPlan(debt, installments);

    await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      const count = await tx.first<{ count: number }>(
        "SELECT COUNT(*) AS count FROM debts WHERE farm_id = ? AND deleted_at IS NULL",
        [farmId]
      );
      if ((count?.count ?? 0) >= MAX_ACTIVE_DEBTS) {
        throw new Error("En fazla 100 aktif borç tutulabilir.");
      }

      await tx.run(
        `INSERT INTO debts
          (id, farm_id, source_kind, creditor_name, total_kurus, opened_on,
           in_kind_description, note, created_at, updated_at, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local')`,
        [
          debt.id,
          farmId,
          debt.sourceKind,
          debt.creditorName,
          debt.totalKurus,
          debt.openedOn,
          debt.inKindDescription ?? null,
          debt.note ?? null,
          input.nowIso,
          input.nowIso
        ]
      );

      for (const installment of installments) {
        await tx.run(
          `INSERT INTO debt_installments
            (id, farm_id, debt_id, due_on, amount_kurus, created_at, updated_at, sync_state)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'local')`,
          [
            installment.id,
            farmId,
            debt.id,
            installment.dueOn,
            installment.amountKurus,
            input.nowIso,
            input.nowIso
          ]
        );
      }
    });
  }

  public async listBalances(farmIdRaw: string): Promise<readonly DebtBalance[]> {
    const farmId = validateId(farmIdRaw, "Çiftlik kimliği");
    await assertActiveFarm(this.db, farmId);
    await assertDebtIntegrity(this.db, farmId);

    const debtRows = await this.db.all<StoredDebtRow>(
      `SELECT id, source_kind, creditor_name, total_kurus, opened_on, in_kind_description, note
         FROM debts
        WHERE farm_id = ? AND deleted_at IS NULL
        ORDER BY opened_on DESC, id DESC
        LIMIT ?`,
      [farmId, MAX_ACTIVE_DEBTS + 1]
    );
    if (debtRows.length > MAX_ACTIVE_DEBTS) {
      throw new Error("Borç sayısı güvenli okuma sınırını aşıyor. Borç hesabı gösterilmedi.");
    }
    if (debtRows.length === 0) return [];

    const installmentRows = await this.db.all<StoredInstallmentRow>(
      `SELECT id, debt_id, due_on, amount_kurus
         FROM debt_installments
        WHERE farm_id = ? AND deleted_at IS NULL
        ORDER BY debt_id, due_on, id
        LIMIT ?`,
      [farmId, MAX_ACTIVE_DEBTS * MAX_INSTALLMENTS_PER_DEBT + 1]
    );
    if (installmentRows.length > MAX_ACTIVE_DEBTS * MAX_INSTALLMENTS_PER_DEBT) {
      throw new Error("Taksit sayısı güvenli okuma sınırını aşıyor. Borç hesabı gösterilmedi.");
    }

    const paymentRows = await this.db.all<PaymentAggregateRow>(
      `SELECT debt_id, SUM(amount_kurus) AS paid_kurus, COUNT(*) AS payment_count
         FROM debt_payments
        WHERE farm_id = ? AND deleted_at IS NULL
        GROUP BY debt_id`,
      [farmId]
    );

    const installmentsByDebt = new Map<string, DebtInstallment[]>();
    for (const row of installmentRows) {
      const list = installmentsByDebt.get(row.debt_id) ?? [];
      list.push(createDebtInstallment({ id: row.id, dueOn: row.due_on, amountKurus: row.amount_kurus }));
      installmentsByDebt.set(row.debt_id, list);
    }

    const paymentsByDebt = new Map<string, { paidKurus: MoneyKurus; paymentCount: number }>();
    for (const row of paymentRows) {
      if (!Number.isSafeInteger(row.payment_count) || row.payment_count < 0 || row.payment_count > MAX_PAYMENTS_PER_DEBT) {
        throw new Error("Borç ödeme sayısı geçersiz. Borç hesabı gösterilmedi.");
      }
      const paidKurus = moneyFromKurus(row.paid_kurus);
      if (paidKurus < 0) throw new Error("Borç ödeme toplamı geçersiz. Borç hesabı gösterilmedi.");
      paymentsByDebt.set(row.debt_id, { paidKurus, paymentCount: row.payment_count });
    }

    return debtRows.map((row) => {
      const debt = storedDebt(row);
      const installments = installmentsByDebt.get(debt.id) ?? [];
      assertInstallmentPlan(debt, installments);
      const payment = paymentsByDebt.get(debt.id) ?? { paidKurus: moneyFromKurus(0), paymentCount: 0 };
      if (payment.paidKurus > debt.totalKurus) {
        throw new Error("Borç ödemeleri toplam borcu aşıyor. Borç hesabı gösterilmedi.");
      }

      const remainingKurus = moneyFromKurus(debt.totalKurus - payment.paidKurus);
      const next = nextUnpaidInstallment(installments, payment.paidKurus);
      return {
        debt,
        paidKurus: payment.paidKurus,
        remainingKurus,
        installmentCount: installments.length,
        paymentCount: payment.paymentCount,
        ...(next === undefined ? {} : { nextDueOn: next.dueOn, nextDueAmountKurus: next.remainingKurus })
      };
    });
  }

  public async addPayment(input: {
    readonly farmId: string;
    readonly debtId: string;
    readonly payment: DebtPayment;
    readonly nowIso: string;
  }): Promise<void> {
    const farmId = validateId(input.farmId, "Çiftlik kimliği");
    const debtId = validateId(input.debtId, "Borç kimliği");
    const payment = createDebtPayment(input.payment);
    assertIsoUtcTimestamp(input.nowIso);

    await this.db.transaction(async (tx) => {
      await assertActiveFarm(tx, farmId);
      await assertDebtIntegrity(tx, farmId);
      const row = await tx.first<StoredDebtRow>(
        `SELECT id, source_kind, creditor_name, total_kurus, opened_on, in_kind_description, note
           FROM debts
          WHERE farm_id = ? AND id = ? AND deleted_at IS NULL`,
        [farmId, debtId]
      );
      if (row === null) throw new Error("Bu borç bulunamadı. Ödeme kaydedilmedi.");
      const debt = storedDebt(row);
      if (payment.occurredOn < debt.openedOn) {
        throw new Error("Ödeme tarihi borcun başlangıcından önce olamaz.");
      }

      const aggregate = await tx.first<{ paid_kurus: number; payment_count: number }>(
        `SELECT COALESCE(SUM(amount_kurus), 0) AS paid_kurus, COUNT(*) AS payment_count
           FROM debt_payments
          WHERE farm_id = ? AND debt_id = ? AND deleted_at IS NULL`,
        [farmId, debtId]
      );
      const paidKurus = moneyFromKurus(aggregate?.paid_kurus ?? 0);
      const paymentCount = aggregate?.payment_count ?? 0;
      if (!Number.isSafeInteger(paymentCount) || paymentCount < 0 || paymentCount >= MAX_PAYMENTS_PER_DEBT) {
        throw new Error("Bu borç için ödeme kayıt sınırına ulaşıldı.");
      }
      if (paidKurus > debt.totalKurus) {
        throw new Error("Borç ödemeleri toplam borcu aşıyor. Ödeme kaydedilmedi.");
      }
      const remainingKurus = moneyFromKurus(debt.totalKurus - paidKurus);
      if (remainingKurus <= 0) throw new Error("Bu borç zaten kapanmış.");
      if (payment.amountKurus > remainingKurus) {
        throw new Error("Ödeme kalan borçtan büyük olamaz.");
      }

      await tx.run(
        `INSERT INTO debt_payments
          (id, farm_id, debt_id, amount_kurus, occurred_on, note, created_at, updated_at, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'local')`,
        [
          payment.id,
          farmId,
          debtId,
          payment.amountKurus,
          payment.occurredOn,
          payment.note ?? null,
          input.nowIso,
          input.nowIso
        ]
      );
    });
  }
}

function storedDebt(row: StoredDebtRow): FarmDebt {
  return createFarmDebt({
    id: row.id,
    sourceKind: parseDebtSourceKind(row.source_kind),
    creditorName: row.creditor_name,
    totalKurus: row.total_kurus,
    openedOn: row.opened_on,
    ...(row.in_kind_description === null ? {} : { inKindDescription: row.in_kind_description }),
    ...(row.note === null ? {} : { note: row.note })
  });
}

function assertInstallmentPlan(debt: FarmDebt, installments: readonly DebtInstallment[]): void {
  if (installments.length < 1 || installments.length > MAX_INSTALLMENTS_PER_DEBT) {
    throw new Error(`Borç için 1-${MAX_INSTALLMENTS_PER_DEBT} ödeme tarihi olmalı.`);
  }
  const ids = new Set<string>();
  let total = 0n;
  for (const installment of installments) {
    if (ids.has(installment.id)) throw new Error("Taksit kimliği tekrar ediyor.");
    ids.add(installment.id);
    if (installment.dueOn < debt.openedOn) {
      throw new Error("Ödeme tarihi borcun başlangıcından önce olamaz.");
    }
    total += BigInt(installment.amountKurus);
  }
  if (total !== BigInt(debt.totalKurus)) {
    throw new Error("Taksitlerin toplamı toplam borçla aynı olmalı.");
  }
}

function nextUnpaidInstallment(
  installments: readonly DebtInstallment[],
  paidKurus: MoneyKurus
): { readonly dueOn: string; readonly remainingKurus: MoneyKurus } | undefined {
  let unapplied = paidKurus;
  for (const installment of installments) {
    if (unapplied >= installment.amountKurus) {
      unapplied = moneyFromKurus(unapplied - installment.amountKurus);
      continue;
    }
    return {
      dueOn: installment.dueOn,
      remainingKurus: moneyFromKurus(installment.amountKurus - unapplied)
    };
  }
  return undefined;
}

async function assertDebtIntegrity(database: SqlExecutor, farmId: string): Promise<void> {
  const row = await database.first<{ orphan_installments: number; orphan_payments: number }>(
    `SELECT
       (SELECT COUNT(*)
          FROM debt_installments i
          LEFT JOIN debts d ON d.farm_id = i.farm_id AND d.id = i.debt_id
         WHERE i.farm_id = ? AND i.deleted_at IS NULL
           AND (d.id IS NULL OR d.deleted_at IS NOT NULL)) AS orphan_installments,
       (SELECT COUNT(*)
          FROM debt_payments p
          LEFT JOIN debts d ON d.farm_id = p.farm_id AND d.id = p.debt_id
         WHERE p.farm_id = ? AND p.deleted_at IS NULL
           AND (d.id IS NULL OR d.deleted_at IS NOT NULL)) AS orphan_payments`,
    [farmId, farmId]
  );
  if (row === null || row.orphan_installments !== 0 || row.orphan_payments !== 0) {
    throw new Error("Borç hesabında eşleşmeyen kayıt bulundu. Borç hesabı gösterilmedi.");
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
    throw new Error("Bu çiftlik aktif değil. Borç hesabı değiştirilmedi.");
  }
}

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) {
    throw new Error(`${field} geçersiz.`);
  }
  return normalized;
}
