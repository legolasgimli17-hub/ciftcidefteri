import { assertIsoCalendarDate } from "./date";
import { type MoneyKurus, moneyFromKurus } from "./money";

export type PartnershipSettlementDirection = "partner_to_owner" | "owner_to_partner";

export interface PartnershipSettlement {
  readonly id: string;
  readonly partnerId: string;
  readonly amountKurus: MoneyKurus;
  readonly occurredOn: string;
  readonly direction: PartnershipSettlementDirection;
  readonly note?: string;
}

export function createPartnershipSettlement(input: {
  readonly id: string;
  readonly partnerId: string;
  readonly amountKurus: number;
  readonly occurredOn: string;
  readonly direction: PartnershipSettlementDirection;
  readonly note?: string;
}): PartnershipSettlement {
  const id = validateId(input.id, "Hesap kapatma kimliği");
  const partnerId = validateId(input.partnerId, "Ortak kimliği");
  const amountKurus = moneyFromKurus(input.amountKurus);
  if (amountKurus <= 0) {
    throw new Error("Hesap kapatma tutarı sıfırdan büyük olmalı.");
  }
  assertIsoCalendarDate(input.occurredOn);
  if (input.direction !== "partner_to_owner" && input.direction !== "owner_to_partner") {
    throw new Error("Hesap kapatma yönü geçersiz.");
  }
  const note = normalizeOptionalText(input.note, 180);

  return {
    id,
    partnerId,
    amountKurus,
    occurredOn: input.occurredOn,
    direction: input.direction,
    ...(note === undefined ? {} : { note })
  };
}

/**
 * Positive impact increases the owner's receivable / reduces the owner's payable.
 * Negative impact reduces the owner's receivable / increases the owner's payable.
 */
export function ownerBalanceImpactFromSettlement(settlement: PartnershipSettlement): MoneyKurus {
  return moneyFromKurus(
    settlement.direction === "owner_to_partner"
      ? settlement.amountKurus
      : -settlement.amountKurus
  );
}

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) {
    throw new Error(`${field} geçersiz.`);
  }
  return normalized;
}

function normalizeOptionalText(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) return undefined;
  if (normalized.length > max) {
    throw new Error(`Açıklama en fazla ${max} karakter olabilir.`);
  }
  return normalized;
}
