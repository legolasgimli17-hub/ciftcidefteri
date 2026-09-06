import * as Crypto from "expo-crypto";

export function createLocalId(prefix: "profile" | "farm" | "txn"): string {
  return `${prefix}-${Crypto.randomUUID()}`;
}
