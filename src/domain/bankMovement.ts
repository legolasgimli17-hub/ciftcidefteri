import { assertIsoCalendarDate } from "./date";
import { moneyFromKurus, type MoneyKurus } from "./money";

export const bankMovementKinds = ["withdrawal", "deposit"] as const;
export type BankMovementKind = (typeof bankMovementKinds)[number];

export interface BankMovement {
  readonly id: string;
  readonly kind: BankMovementKind;
  readonly amountKurus: MoneyKurus;
  readonly occurredOn: string;
  readonly bankName?: string;
  readonly note?: string;
}

export function createBankMovement(input: {
  readonly id: string;
  readonly kind: BankMovementKind;
  readonly amountKurus: number;
  readonly occurredOn: string;
  readonly bankName?: string;
  readonly note?: string;
}): BankMovement {
  const id = validateId(input.id, "Banka hareketi kimliği");
  const kind = parseBankMovementKind(input.kind);
  const amountKurus = moneyFromKurus(input.amountKurus);
  if (amountKurus <= 0) throw new Error("Banka hareketi tutarı sıfırdan büyük olmalı.");
  assertIsoCalendarDate(input.occurredOn);

  const bankName = normalizeOptionalText(input.bankName, "Banka adı", 2, 100);
  const note = normalizeOptionalText(input.note, "Banka hareketi notu", 1, 180);
  return {
    id,
    kind,
    amountKurus,
    occurredOn: input.occurredOn,
    ...(bankName === undefined ? {} : { bankName }),
    ...(note === undefined ? {} : { note })
  };
}

export function parseBankMovementKind(value: string): BankMovementKind {
  if ((bankMovementKinds as readonly string[]).includes(value)) return value as BankMovementKind;
  throw new Error("Banka hareketi türü geçersiz.");
}

export function bankMovementLabel(kind: BankMovementKind): string {
  return kind === "withdrawal" ? "Bankadan çektim" : "Bankaya yatırdım";
}

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) throw new Error(`${field} geçersiz.`);
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
