export type MoneyKurus = number & { readonly __brand: "MoneyKurus" };

export const MAX_SAFE_KURUS = 9_000_000_000_000;

export function moneyFromKurus(value: number): MoneyKurus {
  if (!Number.isSafeInteger(value)) {
    throw new Error("Para tutarı kuruş cinsinden tam sayı olmalı.");
  }
  if (Math.abs(value) > MAX_SAFE_KURUS) {
    throw new Error("Para tutarı desteklenen sınırı aşıyor.");
  }
  return value as MoneyKurus;
}

export function moneyFromLira(value: number): MoneyKurus {
  if (!Number.isFinite(value)) {
    throw new Error("Geçerli bir para tutarı girilmeli.");
  }
  return moneyFromKurus(Math.round(value * 100));
}

export function moneyFromUserInput(raw: string): MoneyKurus {
  const normalized = raw
    .trim()
    .replace(/₺/g, "")
    .replace(/\bTL\b/gi, "")
    .replace(/\s+/g, "");

  if (normalized.length === 0) {
    throw new Error("Tutar boş bırakılamaz.");
  }
  if (normalized.startsWith("-")) {
    throw new Error("Tutar sıfırdan büyük olmalı.");
  }
  if (normalized.startsWith("+")) {
    throw new Error("Tutarın başına + işareti yazma.");
  }

  const parsed = splitTurkishAmount(normalized);
  const whole = BigInt(parsed.wholeDigits);
  const fraction = BigInt(parsed.fractionDigits.padEnd(2, "0"));
  const kurus = whole * 100n + fraction;

  if (kurus > BigInt(MAX_SAFE_KURUS)) {
    throw new Error("Para tutarı desteklenen sınırı aşıyor.");
  }

  return moneyFromKurus(Number(kurus));
}

function splitTurkishAmount(value: string): { wholeDigits: string; fractionDigits: string } {
  if (!/^[0-9.,]+$/.test(value)) {
    throw new Error("Tutar sadece rakam ve virgül/nokta içermeli.");
  }

  const commaCount = count(value, ",");
  const dotCount = count(value, ".");

  if (commaCount > 1) {
    throw new Error("Tutar biçimi anlaşılmadı.");
  }

  if (commaCount === 1) {
    const [wholePart = "", fractionPart = ""] = value.split(",");
    if (fractionPart.length > 2) {
      throw new Error("Kuruş için en fazla iki rakam yaz.");
    }
    if (wholePart.length === 0 || fractionPart.length === 0) {
      throw new Error("Tutar biçimi anlaşılmadı.");
    }
    if (!isValidThousandsGrouping(wholePart, ".")) {
      throw new Error("Tutar biçimi anlaşılmadı.");
    }
    return {
      wholeDigits: wholePart.replace(/\./g, ""),
      fractionDigits: fractionPart
    };
  }

  if (dotCount === 0) {
    return { wholeDigits: value, fractionDigits: "" };
  }

  if (dotCount === 1) {
    const [left = "", right = ""] = value.split(".");
    if (left.length === 0 || right.length === 0) {
      throw new Error("Tutar biçimi anlaşılmadı.");
    }

    // Türkiye biçiminde 1.234 = bin iki yüz otuz dört.
    if (right.length === 3) {
      return { wholeDigits: left + right, fractionDigits: "" };
    }
    if (right.length <= 2) {
      return { wholeDigits: left, fractionDigits: right };
    }
    throw new Error("Tutar biçimi anlaşılmadı.");
  }

  if (!isValidThousandsGrouping(value, ".")) {
    throw new Error("Tutar biçimi anlaşılmadı.");
  }
  return { wholeDigits: value.replace(/\./g, ""), fractionDigits: "" };
}

function isValidThousandsGrouping(value: string, separator: string): boolean {
  if (!value.includes(separator)) return /^\d+$/.test(value);
  const groups = value.split(separator);
  const first = groups[0];
  if (!first || first.length > 3 || !/^\d+$/.test(first)) return false;
  return groups.slice(1).every((group) => /^\d{3}$/.test(group));
}

function count(value: string, needle: string): number {
  return [...value].filter((char) => char === needle).length;
}

export function addMoney(a: MoneyKurus, b: MoneyKurus): MoneyKurus {
  return moneyFromKurus(a + b);
}

export function subtractMoney(a: MoneyKurus, b: MoneyKurus): MoneyKurus {
  return moneyFromKurus(a - b);
}

export function formatTry(value: MoneyKurus): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}
