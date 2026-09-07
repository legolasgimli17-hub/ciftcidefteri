import { assertIsoCalendarDate } from "./date";

export const inventoryItemKinds = ["product", "input"] as const;
export const inventoryUnits = ["kg", "ton", "litre", "piece", "sack"] as const;
export const inventoryMovementKinds = ["increase", "decrease"] as const;

export type InventoryItemKind = (typeof inventoryItemKinds)[number];
export type InventoryUnit = (typeof inventoryUnits)[number];
export type InventoryMovementKind = (typeof inventoryMovementKinds)[number];
export type InventoryQuantityMilli = number & { readonly __brand: "InventoryQuantityMilli" };

export const MAX_SAFE_QUANTITY_MILLI = 9_000_000_000_000;

export interface InventoryItem {
  readonly id: string;
  readonly kind: InventoryItemKind;
  readonly name: string;
  readonly unit: InventoryUnit;
}

export interface InventoryMovement {
  readonly id: string;
  readonly itemId: string;
  readonly kind: InventoryMovementKind;
  readonly quantityMilli: InventoryQuantityMilli;
  readonly occurredOn: string;
  readonly note?: string;
}

export function quantityMilliFromStored(value: number): InventoryQuantityMilli {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_SAFE_QUANTITY_MILLI) {
    throw new Error("Miktar verisi geçersiz.");
  }
  return value as InventoryQuantityMilli;
}

export function positiveQuantityMilliFromStored(value: number): InventoryQuantityMilli {
  const quantity = quantityMilliFromStored(value);
  if (quantity <= 0) throw new Error("Miktar sıfırdan büyük olmalı.");
  return quantity;
}

export function quantityMilliFromUserInput(raw: string): InventoryQuantityMilli {
  const normalized = raw.trim().replace(/\s+/g, "");
  if (normalized.length === 0) throw new Error("Miktar boş bırakılamaz.");
  if (normalized.startsWith("-") || normalized.startsWith("+")) {
    throw new Error("Miktar sıfırdan büyük olmalı.");
  }
  if (!/^\d+(?:[.,]\d{1,3})?$/.test(normalized)) {
    throw new Error("Miktarı 12 veya 12,5 gibi yaz.");
  }

  const separatorIndex = Math.max(normalized.lastIndexOf(","), normalized.lastIndexOf("."));
  const wholeText = separatorIndex < 0 ? normalized : normalized.slice(0, separatorIndex);
  const fractionText = separatorIndex < 0 ? "" : normalized.slice(separatorIndex + 1);
  const milli = BigInt(wholeText) * 1000n + BigInt(fractionText.padEnd(3, "0"));
  if (milli <= 0n) throw new Error("Miktar sıfırdan büyük olmalı.");
  if (milli > BigInt(MAX_SAFE_QUANTITY_MILLI)) throw new Error("Miktar desteklenen sınırı aşıyor.");
  return positiveQuantityMilliFromStored(Number(milli));
}

export function createInventoryItem(input: {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly unit: string;
}): InventoryItem {
  return {
    id: validateId(input.id, "Kalem kimliği"),
    kind: parseInventoryItemKind(input.kind),
    name: normalizeRequiredText(input.name, "Ad", 2, 80),
    unit: parseInventoryUnit(input.unit)
  };
}

export function createInventoryMovement(input: {
  readonly id: string;
  readonly itemId: string;
  readonly kind: string;
  readonly quantityMilli: number;
  readonly occurredOn: string;
  readonly note?: string;
}): InventoryMovement {
  assertIsoCalendarDate(input.occurredOn);
  const note = normalizeOptionalText(input.note, 180);
  return {
    id: validateId(input.id, "Hareket kimliği"),
    itemId: validateId(input.itemId, "Kalem kimliği"),
    kind: parseInventoryMovementKind(input.kind),
    quantityMilli: positiveQuantityMilliFromStored(input.quantityMilli),
    occurredOn: input.occurredOn,
    ...(note === undefined ? {} : { note })
  };
}

export function parseInventoryItemKind(value: string): InventoryItemKind {
  if ((inventoryItemKinds as readonly string[]).includes(value)) return value as InventoryItemKind;
  throw new Error("Kalem türü geçersiz.");
}

export function parseInventoryUnit(value: string): InventoryUnit {
  if ((inventoryUnits as readonly string[]).includes(value)) return value as InventoryUnit;
  throw new Error("Birim geçersiz.");
}

export function parseInventoryMovementKind(value: string): InventoryMovementKind {
  if ((inventoryMovementKinds as readonly string[]).includes(value)) return value as InventoryMovementKind;
  throw new Error("Hareket türü geçersiz.");
}

export function inventoryItemKindLabel(kind: InventoryItemKind): string {
  return kind === "product" ? "Ürün" : "Girdi";
}

export function inventoryUnitLabel(unit: InventoryUnit): string {
  switch (unit) {
    case "kg": return "kg";
    case "ton": return "ton";
    case "litre": return "litre";
    case "piece": return "adet";
    case "sack": return "çuval";
  }
}

export function inventoryMovementLabel(kind: InventoryMovementKind): string {
  return kind === "increase" ? "Eklendi" : "Azaldı";
}

export function formatInventoryQuantity(quantityMilli: InventoryQuantityMilli, unit: InventoryUnit): string {
  const value = Number(quantityMilli) / 1000;
  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  }).format(value);
  return `${formatted} ${inventoryUnitLabel(unit)}`;
}

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 80) throw new Error(`${field} geçersiz.`);
  return normalized;
}

function normalizeRequiredText(value: string, field: string, min: number, max: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < min || normalized.length > max) {
    throw new Error(`${field} ${min}-${max} karakter olmalı.`);
  }
  return normalized;
}

function normalizeOptionalText(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) return undefined;
  if (normalized.length > max) throw new Error(`Not en fazla ${max} karakter olmalı.`);
  return normalized;
}
