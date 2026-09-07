import { type MoneyKurus, moneyFromKurus } from "./money";
import { type TransactionKind } from "./transaction";

export const BASIS_POINTS_TOTAL = 10_000 as const;

export type PartnershipCashActor = "owner" | "partner";

export interface TransactionPartnership {
  readonly partnerId: string;
  readonly ownerShareBasisPoints: number;
  readonly cashActor: PartnershipCashActor;
}

export interface PartnershipAmounts {
  readonly ownerAmountKurus: MoneyKurus;
  readonly partnerAmountKurus: MoneyKurus;
}

export interface OwnerPartnerBalanceImpact {
  /** Positive amount that the partner owes the owner. */
  readonly receivableKurus: MoneyKurus;
  /** Positive amount that the owner owes the partner. */
  readonly payableKurus: MoneyKurus;
  /** receivable - payable. Positive means "alacağım", negative means "borcum". */
  readonly netKurus: MoneyKurus;
}

export function createTransactionPartnership(input: {
  readonly partnerId: string;
  readonly ownerShareBasisPoints: number;
  readonly cashActor: PartnershipCashActor;
}): TransactionPartnership {
  const partnerId = input.partnerId.trim();
  if (partnerId.length < 8 || partnerId.length > 80) {
    throw new Error("Ortak kimliği geçersiz.");
  }
  if (
    !Number.isSafeInteger(input.ownerShareBasisPoints) ||
    input.ownerShareBasisPoints <= 0 ||
    input.ownerShareBasisPoints >= BASIS_POINTS_TOTAL
  ) {
    throw new Error("Ortaklık payı yüzde 0 ile yüzde 100 arasında olmalı.");
  }
  if (input.cashActor !== "owner" && input.cashActor !== "partner") {
    throw new Error("Parayı ödeyen/alan kişi geçersiz.");
  }

  return {
    partnerId,
    ownerShareBasisPoints: input.ownerShareBasisPoints,
    cashActor: input.cashActor
  };
}

/**
 * Splits the transaction amount without floating point arithmetic.
 * Owner share is rounded to the nearest kurus (half-up); partner receives the exact residual,
 * therefore owner + partner always equals the original transaction amount.
 */
export function splitPartnershipAmount(
  amountKurusRaw: number,
  ownerShareBasisPointsRaw: number
): PartnershipAmounts {
  const amountKurus = moneyFromKurus(amountKurusRaw);
  if (amountKurus <= 0) {
    throw new Error("Ortaklık hesabı için tutar sıfırdan büyük olmalı.");
  }
  if (
    !Number.isSafeInteger(ownerShareBasisPointsRaw) ||
    ownerShareBasisPointsRaw <= 0 ||
    ownerShareBasisPointsRaw >= BASIS_POINTS_TOTAL
  ) {
    throw new Error("Ortaklık payı geçersiz.");
  }

  const numerator = BigInt(amountKurus) * BigInt(ownerShareBasisPointsRaw);
  const ownerAmount = Number((numerator + 5_000n) / 10_000n);
  const partnerAmount = amountKurus - ownerAmount;

  return {
    ownerAmountKurus: moneyFromKurus(ownerAmount),
    partnerAmountKurus: moneyFromKurus(partnerAmount)
  };
}

/**
 * Calculates only the owner's balance against this partner.
 * No separate debt record is written: balances are derived from the source transaction.
 */
export function ownerPartnerBalanceImpact(input: {
  readonly kind: TransactionKind;
  readonly amountKurus: number;
  readonly partnership: TransactionPartnership;
}): OwnerPartnerBalanceImpact {
  const partnership = createTransactionPartnership(input.partnership);
  const split = splitPartnershipAmount(input.amountKurus, partnership.ownerShareBasisPoints);

  let receivable = 0;
  let payable = 0;

  if (input.kind === "expense") {
    if (partnership.cashActor === "owner") receivable = split.partnerAmountKurus;
    else payable = split.ownerAmountKurus;
  } else if (input.kind === "income") {
    if (partnership.cashActor === "owner") payable = split.partnerAmountKurus;
    else receivable = split.ownerAmountKurus;
  } else {
    throw new Error("Ortaklık hesabında işlem türü geçersiz.");
  }

  return {
    receivableKurus: moneyFromKurus(receivable),
    payableKurus: moneyFromKurus(payable),
    netKurus: moneyFromKurus(receivable - payable)
  };
}

export function basisPointsFromPercent(percent: number): number {
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
    throw new Error("Pay yüzdesi 0 ile 100 arasında olmalı.");
  }
  const basisPoints = Math.round(percent * 100);
  if (!Number.isSafeInteger(basisPoints) || basisPoints <= 0 || basisPoints >= BASIS_POINTS_TOTAL) {
    throw new Error("Pay yüzdesi geçersiz.");
  }
  return basisPoints;
}

export function basisPointsFromUserInput(raw: string): number {
  const normalized = raw.trim().replace(",", ".");
  if (!/^(?:[1-9]\d?|0?\.\d{1,2}|[1-9]\d?\.\d{1,2})$/.test(normalized)) {
    throw new Error("Payı 0 ile 100 arasında yüzde olarak yaz.");
  }
  const percent = Number(normalized);
  return basisPointsFromPercent(percent);
}

export function percentLabelFromBasisPoints(basisPoints: number): string {
  if (!Number.isSafeInteger(basisPoints) || basisPoints <= 0 || basisPoints >= BASIS_POINTS_TOTAL) {
    throw new Error("Pay yüzdesi geçersiz.");
  }
  const whole = Math.floor(basisPoints / 100);
  const fraction = basisPoints % 100;
  return fraction === 0 ? `%${whole}` : `%${whole},${String(fraction).padStart(2, "0").replace(/0$/, "")}`;
}
