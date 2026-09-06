import { type TransactionKind } from "../domain/transaction";

export type TransactionEntryStep = "crop" | "category";

export function transactionKindFromRoute(value: string | undefined): TransactionKind | null {
  if (value === "income" || value === "expense") return value;
  return null;
}

export function stepAfterAmount(cropCount: number): TransactionEntryStep {
  if (!Number.isSafeInteger(cropCount) || cropCount < 1) {
    throw new Error("En az bir ürün olmalı.");
  }
  return cropCount === 1 ? "category" : "crop";
}
