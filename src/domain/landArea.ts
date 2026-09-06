export type AreaUnit = "decare" | "donum";
export type SquareMeters = number & { readonly __brand: "SquareMeters" };

const SQUARE_METERS_PER_UNIT = 1_000;
const MAX_SQUARE_METERS = 100_000_000;

export function squareMetersFromUserInput(raw: string, unit: AreaUnit): SquareMeters {
  const normalized = raw.trim().replace(/\s+/g, "");
  if (!/^\d+(?:[,.]\d{1,3})?$/.test(normalized)) {
    throw new Error("Arazi büyüklüğünü örneğin 25 veya 25,5 diye yaz.");
  }

  const [wholePart = "0", fractionPart = ""] = normalized.replace(",", ".").split(".");
  const thousandths = BigInt(wholePart) * 1_000n + BigInt(fractionPart.padEnd(3, "0"));
  const squareMeters = (thousandths * BigInt(SQUARE_METERS_PER_UNIT)) / 1_000n;

  if (squareMeters <= 0n) {
    throw new Error("Arazi büyüklüğü sıfırdan büyük olmalı.");
  }
  if (squareMeters > BigInt(MAX_SQUARE_METERS)) {
    throw new Error("Arazi büyüklüğü desteklenen sınırı aşıyor.");
  }

  // Dönüm ve dekar Türkiye'deki günlük kullanımda aynı 1.000 m² tabana normalize edilir.
  void unit;
  return Number(squareMeters) as SquareMeters;
}

export function squareMetersFromStoredValue(value: number): SquareMeters {
  if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_SQUARE_METERS) {
    throw new Error("Yerel veride arazi büyüklüğü geçersiz.");
  }
  return value as SquareMeters;
}

export function formatArea(squareMeters: SquareMeters, unit: AreaUnit): string {
  void unit;
  const whole = Math.floor(squareMeters / SQUARE_METERS_PER_UNIT);
  const remainder = squareMeters % SQUARE_METERS_PER_UNIT;
  if (remainder === 0) return `${whole}`;
  return `${whole},${String(remainder).padStart(3, "0").replace(/0+$/, "")}`;
}
