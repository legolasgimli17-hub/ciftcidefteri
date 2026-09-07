import * as Crypto from "expo-crypto";

export type LocalIdPrefix =
  | "profile"
  | "farm"
  | "txn"
  | "partner"
  | "settlement"
  | "debt"
  | "installment"
  | "debtpay"
  | "bankmove"
  | "stockitem"
  | "stockmove";

export function createLocalId(prefix: LocalIdPrefix): string {
  return `${prefix}-${Crypto.randomUUID()}`;
}
