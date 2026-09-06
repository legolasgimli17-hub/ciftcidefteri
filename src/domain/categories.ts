import { type TransactionKind } from "./transaction";

export const PUBLIC_AGRICULTURAL_SUPPORT_CATEGORY = "Kamu tarım desteği" as const;

export const commonIncomeCategories = [
  "Ürün satışı",
  PUBLIC_AGRICULTURAL_SUPPORT_CATEGORY,
  "Diğer gelir"
] as const;

export const commonExpenseCategories = [
  "Mazot",
  "Gübre",
  "İlaç",
  "İşçilik",
  "Diğer gider"
] as const;

export function isTaxExemptPublicAgriculturalSupport(
  kind: TransactionKind,
  category: string
): boolean {
  return kind === "income" && category === PUBLIC_AGRICULTURAL_SUPPORT_CATEGORY;
}
