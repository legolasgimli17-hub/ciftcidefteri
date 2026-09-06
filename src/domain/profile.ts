import { cropCodes, type CropCode } from "./crops";
import { type SquareMeters } from "./landArea";

export interface FarmerProfile {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly province: string;
  readonly district: string;
  readonly village: string;
  readonly totalAreaSquareMeters: SquareMeters;
  readonly cropCodes: readonly CropCode[];
  readonly isCksRegistered?: boolean;
}

export interface NewFarmerProfile extends Omit<FarmerProfile, "name" | "phone" | "province" | "district" | "village" | "cropCodes"> {
  readonly name: string;
  readonly phone: string;
  readonly province: string;
  readonly district: string;
  readonly village: string;
  readonly cropCodes: readonly string[];
}

export function createFarmerProfile(input: NewFarmerProfile): FarmerProfile {
  const id = normalizeRequiredText(input.id, "Profil kimliği", 8, 80);
  const name = normalizeRequiredText(input.name, "Ad", 2, 80);
  const phone = normalizePhone(input.phone);
  const province = normalizeRequiredText(input.province, "İl", 2, 80);
  const district = normalizeRequiredText(input.district, "İlçe", 2, 80);
  const village = normalizeRequiredText(input.village, "Köy", 1, 80);
  const crops = uniqueCropCodes(input.cropCodes);

  if (input.totalAreaSquareMeters <= 0) {
    throw new Error("Arazi büyüklüğü sıfırdan büyük olmalı.");
  }

  return {
    id,
    name,
    phone,
    province,
    district,
    village,
    totalAreaSquareMeters: input.totalAreaSquareMeters,
    cropCodes: crops,
    ...(input.isCksRegistered === undefined ? {} : { isCksRegistered: input.isCksRegistered })
  };
}

function normalizePhone(raw: string): string {
  let value = raw.trim().replace(/[\s()-]/g, "");
  if (value.startsWith("00")) value = `+${value.slice(2)}`;
  if (value.startsWith("0")) value = `+90${value.slice(1)}`;
  else if (/^5\d{9}$/.test(value)) value = `+90${value}`;

  if (!/^\+?\d{10,15}$/.test(value)) {
    throw new Error("Telefon numarasını kontrol et.");
  }
  return value;
}

function uniqueCropCodes(values: readonly string[]): readonly CropCode[] {
  if (values.length === 0) {
    throw new Error("En az bir ürün seç.");
  }

  const allowed = new Set<string>(cropCodes);
  const result: CropCode[] = [];
  for (const value of values) {
    if (!allowed.has(value)) {
      throw new Error("Seçilen ürünlerden biri tanınmıyor.");
    }
    const crop = value as CropCode;
    if (!result.includes(crop)) result.push(crop);
  }
  return result;
}

function normalizeRequiredText(value: string, field: string, min: number, max: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < min || normalized.length > max) {
    throw new Error(`${field} ${min}-${max} karakter olmalı.`);
  }
  return normalized;
}
