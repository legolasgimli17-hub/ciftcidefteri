import { type CropCode } from "./crops";
import { assertIsoCalendarDate } from "./date";
import { type MoneyKurus, moneyFromKurus } from "./money";

export type TransactionKind = "income" | "expense";

export interface FarmTransaction {
  readonly id: string;
  readonly kind: TransactionKind;
  readonly amountKurus: MoneyKurus;
  readonly occurredOn: string;
  readonly category: string;
  readonly cropCode?: CropCode;
  readonly note?: string;
  readonly isTaxExemptSupport: boolean;
}

export interface NewFarmTransaction {
  readonly id: string;
  readonly kind: TransactionKind;
  readonly amountKurus: number;
  readonly occurredOn: string;
  readonly category: string;
  readonly cropCode?: CropCode;
  readonly note?: string;
  readonly isTaxExemptSupport?: boolean;
}

export function createFarmTransaction(input: NewFarmTransaction): FarmTransaction {
  const id = input.id.trim();
  if (id.length < 8 || id.length > 80) {
    throw new Error("İşlem kimliği geçersiz.");
  }

  if (input.kind !== "income" && input.kind !== "expense") {
    throw new Error("İşlem türü geçersiz.");
  }

  assertIsoCalendarDate(input.occurredOn);

  const category = normalizeShortText(input.category, "Kategori", 60);
  const note = input.note === undefined ? undefined : normalizeOptionalText(input.note, 240);
  const amountKurus = moneyFromKurus(input.amountKurus);

  if (amountKurus <= 0) {
    throw new Error("Tutar sıfırdan büyük olmalı.");
  }

  const result: FarmTransaction = {
    id,
    kind: input.kind,
    amountKurus,
    occurredOn: input.occurredOn,
    category,
    isTaxExemptSupport: input.isTaxExemptSupport ?? false,
    ...(input.cropCode === undefined ? {} : { cropCode: input.cropCode }),
    ...(note === undefined ? {} : { note })
  };

  if (result.isTaxExemptSupport && result.kind !== "income") {
    throw new Error("Destekleme istisnası sadece gelir kaydında kullanılabilir.");
  }

  return result;
}

function normalizeShortText(value: string, field: string, max: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0 || normalized.length > max) {
    throw new Error(`${field} 1-${max} karakter olmalı.`);
  }
  return normalized;
}

function normalizeOptionalText(value: string, max: number): string | undefined {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) return undefined;
  if (normalized.length > max) {
    throw new Error(`Açıklama en fazla ${max} karakter olabilir.`);
  }
  return normalized;
}
