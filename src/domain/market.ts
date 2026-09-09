import { assertIsoCalendarDate, assertIsoUtcTimestamp } from "./date";
import { moneyFromKurus, type MoneyKurus } from "./money";

export const marketCategories = ["crop", "vegetable", "fruit", "fuel"] as const;
export type MarketCategory = (typeof marketCategories)[number];

export const marketUnits = ["TRY_KG", "TRY_LITER", "TRY_TON"] as const;
export type MarketUnit = (typeof marketUnits)[number];

export interface MarketPrice {
  readonly unit: MarketUnit;
  readonly minKurus?: MoneyKurus;
  readonly maxKurus?: MoneyKurus;
  readonly averageKurus?: MoneyKurus;
}

export interface MarketSource {
  readonly id: string;
  readonly name: string;
  readonly official: boolean;
  readonly observationDate: string;
  readonly fetchedAt: string;
}

export interface MarketLocation {
  readonly city?: string;
  readonly district?: string;
  readonly market?: string;
}

export interface MarketObservation {
  readonly id: string;
  readonly category: MarketCategory;
  readonly productCode: string;
  readonly productName: string;
  readonly variant?: string;
  readonly price: MarketPrice;
  readonly source: MarketSource;
  readonly location?: MarketLocation;
}

export interface MarketFeed {
  readonly schemaVersion: 1;
  readonly items: readonly MarketObservation[];
}

export function parseMarketFeed(input: unknown): MarketFeed {
  const record = asRecord(input, "Piyasa yanıtı nesne olmalı.");
  if (record.schemaVersion !== 1) {
    throw new Error("Desteklenmeyen piyasa veri sürümü.");
  }
  if (!Array.isArray(record.items)) {
    throw new Error("Piyasa kayıtları liste olmalı.");
  }

  return {
    schemaVersion: 1,
    items: record.items.map(parseMarketObservation)
  };
}

export function parseMarketObservation(input: unknown): MarketObservation {
  const record = asRecord(input, "Piyasa kaydı nesne olmalı.");
  const category = parseCategory(record.category);
  const price = parsePrice(record.price);
  const source = parseSource(record.source);

  const base = {
    id: requiredText(record.id, "Piyasa kayıt kimliği"),
    category,
    productCode: productCode(record.productCode),
    productName: requiredText(record.productName, "Ürün adı"),
    price,
    source
  };

  const variant = optionalText(record.variant, "Ürün varyetesi");
  const location = parseOptionalLocation(record.location);

  return {
    ...base,
    ...(variant === undefined ? {} : { variant }),
    ...(location === undefined ? {} : { location })
  };
}

function parsePrice(input: unknown): MarketPrice {
  const record = asRecord(input, "Fiyat bilgisi nesne olmalı.");
  const unit = parseUnit(record.unit);
  const minKurus = optionalNonNegativeMoney(record.minKurus, "En düşük fiyat");
  const maxKurus = optionalNonNegativeMoney(record.maxKurus, "En yüksek fiyat");
  const averageKurus = optionalNonNegativeMoney(record.averageKurus, "Ortalama fiyat");

  if (minKurus === undefined && maxKurus === undefined && averageKurus === undefined) {
    throw new Error("Piyasa kaydında en az bir fiyat bulunmalı.");
  }
  if (minKurus !== undefined && maxKurus !== undefined && minKurus > maxKurus) {
    throw new Error("En düşük fiyat en yüksek fiyattan büyük olamaz.");
  }
  if (averageKurus !== undefined && minKurus !== undefined && averageKurus < minKurus) {
    throw new Error("Ortalama fiyat en düşük fiyatın altında olamaz.");
  }
  if (averageKurus !== undefined && maxKurus !== undefined && averageKurus > maxKurus) {
    throw new Error("Ortalama fiyat en yüksek fiyatın üstünde olamaz.");
  }

  return {
    unit,
    ...(minKurus === undefined ? {} : { minKurus }),
    ...(maxKurus === undefined ? {} : { maxKurus }),
    ...(averageKurus === undefined ? {} : { averageKurus })
  };
}

function parseSource(input: unknown): MarketSource {
  const record = asRecord(input, "Kaynak bilgisi nesne olmalı.");
  const observationDate = requiredText(record.observationDate, "Veri tarihi");
  const fetchedAt = requiredText(record.fetchedAt, "Alınma zamanı");
  assertIsoCalendarDate(observationDate);
  assertIsoUtcTimestamp(fetchedAt);

  if (typeof record.official !== "boolean") {
    throw new Error("Kaynağın resmî durumu doğru/yanlış olmalı.");
  }

  return {
    id: sourceCode(record.id),
    name: requiredText(record.name, "Kaynak adı"),
    official: record.official,
    observationDate,
    fetchedAt
  };
}

function parseOptionalLocation(input: unknown): MarketLocation | undefined {
  if (input === undefined || input === null) return undefined;
  const record = asRecord(input, "Konum bilgisi nesne olmalı.");
  const city = optionalText(record.city, "İl");
  const district = optionalText(record.district, "İlçe");
  const market = optionalText(record.market, "Piyasa yeri");

  if (city === undefined && district === undefined && market === undefined) return undefined;
  return {
    ...(city === undefined ? {} : { city }),
    ...(district === undefined ? {} : { district }),
    ...(market === undefined ? {} : { market })
  };
}

function parseCategory(input: unknown): MarketCategory {
  if (typeof input !== "string" || !(marketCategories as readonly string[]).includes(input)) {
    throw new Error("Tanınmayan piyasa kategorisi.");
  }
  return input as MarketCategory;
}

function parseUnit(input: unknown): MarketUnit {
  if (typeof input !== "string" || !(marketUnits as readonly string[]).includes(input)) {
    throw new Error("Tanınmayan piyasa fiyat birimi.");
  }
  return input as MarketUnit;
}

function optionalNonNegativeMoney(input: unknown, field: string): MoneyKurus | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0) {
    throw new Error(`${field} kuruş cinsinden sıfır veya daha büyük tam sayı olmalı.`);
  }
  return moneyFromKurus(input);
}

function requiredText(input: unknown, field: string): string {
  if (typeof input !== "string") {
    throw new Error(`${field} metin olmalı.`);
  }
  const value = input.trim();
  if (value.length === 0) {
    throw new Error(`${field} boş bırakılamaz.`);
  }
  if (value.length > 160) {
    throw new Error(`${field} çok uzun.`);
  }
  return value;
}

function optionalText(input: unknown, field: string): string | undefined {
  if (input === undefined || input === null) return undefined;
  return requiredText(input, field);
}

function productCode(input: unknown): string {
  const value = requiredText(input, "Ürün kodu");
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value)) {
    throw new Error("Ürün kodu küçük harf, rakam ve tire içermeli.");
  }
  return value;
}

function sourceCode(input: unknown): string {
  const value = requiredText(input, "Kaynak kodu");
  if (!/^[A-Z0-9][A-Z0-9_-]{0,31}$/.test(value)) {
    throw new Error("Kaynak kodu büyük harf, rakam, tire veya alt çizgi içermeli.");
  }
  return value;
}

function asRecord(input: unknown, errorMessage: string): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error(errorMessage);
  }
  return input as Record<string, unknown>;
}
