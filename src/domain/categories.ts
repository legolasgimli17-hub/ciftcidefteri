import { type TransactionKind } from "./transaction";

export const PUBLIC_AGRICULTURAL_SUPPORT_CATEGORY = "Kamu tarım desteği" as const;

export const commonIncomeCategories = [
  "Ürün satışı",
  PUBLIC_AGRICULTURAL_SUPPORT_CATEGORY,
  "Avans / kapora",
  "Diğer gelir"
] as const;

export const commonExpenseCategories = [
  "Amele / işçilik",
  "Gübre",
  "İlaç",
  "Mazot",
  "Sulama / elektrik",
  "Biçer / hasat",
  "İcar / kira",
  "Tohum / fide",
  "Nakliye",
  "Tamir / bakım",
  "Diğer gider"
] as const;

export const expenseGroupCodes = [
  "labor",
  "fertilizer",
  "pesticide",
  "fuel",
  "irrigation_energy",
  "harvest",
  "rent",
  "seed",
  "transport",
  "maintenance",
  "other"
] as const;

export type ExpenseGroupCode = (typeof expenseGroupCodes)[number];

export const expenseGroupLabels: Readonly<Record<ExpenseGroupCode, string>> = {
  labor: "Amele / işçilik",
  fertilizer: "Gübre",
  pesticide: "İlaç",
  fuel: "Mazot",
  irrigation_energy: "Sulama / elektrik",
  harvest: "Biçer / hasat",
  rent: "İcar / kira",
  seed: "Tohum / fide",
  transport: "Nakliye",
  maintenance: "Tamir / bakım",
  other: "Diğer gider"
};

/**
 * Keeps the farmer-facing detailed category while grouping it for transparent reports.
 * Unknown/custom categories safely fall back to "other" instead of inventing a financial bucket.
 */
export function expenseGroupForCategory(categoryRaw: string): ExpenseGroupCode {
  const category = categoryRaw.trim().toLocaleLowerCase("tr-TR");
  if (category.length === 0) return "other";

  if (includesAny(category, ["amele", "işçilik", "işçi", "yevmiy"])) return "labor";
  if (category.includes("gübre")) return "fertilizer";
  if (includesAny(category, ["ilaç", "pestisit", "herbisit", "fungusit"])) return "pesticide";
  if (includesAny(category, ["mazot", "yakıt", "motorin"])) return "fuel";
  if (includesAny(category, ["sulama", "elektrik", "su ücreti"])) return "irrigation_energy";
  if (includesAny(category, ["biçer", "hasat", "çırçır", "kurutma"])) return "harvest";
  if (includesAny(category, ["icar", "arazi kira", "tarla kira"])) return "rent";
  if (includesAny(category, ["tohum", "tohumluk", "fide"])) return "seed";
  if (includesAny(category, ["nakliye", "taşıma", "kamyon"])) return "transport";
  if (includesAny(category, ["tamir", "bakım", "onarım", "yedek parça"])) return "maintenance";
  return "other";
}

export function isTaxExemptPublicAgriculturalSupport(
  kind: TransactionKind,
  category: string
): boolean {
  return kind === "income" && category === PUBLIC_AGRICULTURAL_SUPPORT_CATEGORY;
}

function includesAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}
