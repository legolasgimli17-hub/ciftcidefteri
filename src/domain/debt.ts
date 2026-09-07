import { assertIsoCalendarDate } from "./date";
import { moneyFromKurus, type MoneyKurus } from "./money";

export const debtSourceKinds = [
  "bank_cash",
  "coop_cash",
  "coop_in_kind",
  "private",
  "cheque_note",
  "other"
] as const;

export type DebtSourceKind = (typeof debtSourceKinds)[number];

export interface FarmDebt {
  readonly id: string;
  readonly sourceKind: DebtSourceKind;
  readonly creditorName: string;
  readonly totalKurus: MoneyKurus;
  readonly openedOn: string;
  readonly inKindDescription?: string;
  readonly note?: string;
}

export interface DebtInstallment {
  readonly id: string;
  readonly dueOn: string;
  readonly amountKurus: MoneyKurus;
}

export interface DebtPayment {
  readonly id: string;
  readonly amountKurus: MoneyKurus;
  readonly occurredOn: string;
  readonly note?: string;
}

export function createFarmDebt(input: {
  readonly id: string;
  readonly sourceKind: DebtSourceKind;
  readonly creditorName: string;
  readonly totalKurus: number;
  readonly openedOn: string;
  readonly inKindDescription?: string;
  readonly note?: string;
}): FarmDebt {
  const id = validateId(input.id, "Borç kimliği");
  const sourceKind = parseDebtSourceKind(input.sourceKind);
  const creditorName = normalizeRequiredText(input.creditorName, "Borç aldığın kişi veya kurum", 2, 100);
  const totalKurus = moneyFromKurus(input.totalKurus);
  if (totalKurus <= 0) throw new Error("Toplam borç sıfırdan büyük olmalı.");
  assertIsoCalendarDate(input.openedOn);

  const inKindDescription = normalizeOptionalText(input.inKindDescription, "Ayni borç açıklaması", 2, 120);
  if (sourceKind === "coop_in_kind" && inKindDescription === undefined) {
    throw new Error("Mal olarak alınan borçta ne aldığını yaz.");
  }
  if (sourceKind !== "coop_in_kind" && inKindDescription !== undefined) {
    throw new Error("Mal açıklaması yalnız ayni borçta kullanılabilir.");
  }

  const note = normalizeOptionalText(input.note, "Borç notu", 1, 240);
  return {
    id,
    sourceKind,
    creditorName,
    totalKurus,
    openedOn: input.openedOn,
    ...(inKindDescription === undefined ? {} : { inKindDescription }),
    ...(note === undefined ? {} : { note })
  };
}

export function createDebtInstallment(input: {
  readonly id: string;
  readonly dueOn: string;
  readonly amountKurus: number;
}): DebtInstallment {
  const id = validateId(input.id, "Taksit kimliği");
  assertIsoCalendarDate(input.dueOn);
  const amountKurus = moneyFromKurus(input.amountKurus);
  if (amountKurus <= 0) throw new Error("Taksit tutarı sıfırdan büyük olmalı.");
  return { id, dueOn: input.dueOn, amountKurus };
}

export function createDebtPayment(input: {
  readonly id: string;
  readonly amountKurus: number;
  readonly occurredOn: string;
  readonly note?: string;
}): DebtPayment {
  const id = validateId(input.id, "Ödeme kimliği");
  assertIsoCalendarDate(input.occurredOn);
  const amountKurus = moneyFromKurus(input.amountKurus);
  if (amountKurus <= 0) throw new Error("Ödeme tutarı sıfırdan büyük olmalı.");
  const note = normalizeOptionalText(input.note, "Ödeme notu", 1, 180);
  return {
    id,
    amountKurus,
    occurredOn: input.occurredOn,
    ...(note === undefined ? {} : { note })
  };
}

export function parseDebtSourceKind(value: string): DebtSourceKind {
  if ((debtSourceKinds as readonly string[]).includes(value)) return value as DebtSourceKind;
  throw new Error("Borç türü geçersiz.");
}

export function debtSourceLabel(kind: DebtSourceKind): string {
  switch (kind) {
    case "bank_cash": return "Banka kredisi";
    case "coop_cash": return "Tarım Kredi - para";
    case "coop_in_kind": return "Tarım Kredi - mal";
    case "private": return "Birinden aldım";
    case "cheque_note": return "Çek / senet";
    case "other": return "Diğer";
  }
}

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) {
    throw new Error(`${field} geçersiz.`);
  }
  return normalized;
}

function normalizeRequiredText(value: string, field: string, min: number, max: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < min || normalized.length > max) {
    throw new Error(`${field} ${min}-${max} karakter olmalı.`);
  }
  return normalized;
}

function normalizeOptionalText(value: string | undefined, field: string, min: number, max: number): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) return undefined;
  if (normalized.length < min || normalized.length > max) {
    throw new Error(`${field} ${min}-${max} karakter olmalı.`);
  }
  return normalized;
}
