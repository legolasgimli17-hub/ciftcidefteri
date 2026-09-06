import { parseCropCode, type CropCode } from "../domain/crops";
import { squareMetersFromStoredValue } from "../domain/landArea";
import { createFarmerProfile, type FarmerProfile } from "../domain/profile";
import { summarizeProfitLoss, type ProfitLossSummary } from "../domain/profitLoss";
import { type FarmTransaction } from "../domain/transaction";
import { type SqlDatabase } from "../storage/sql";
import { LocalFarmRepository } from "./localFarmRepository";

export interface FarmIdentity {
  readonly farmId: string;
  readonly farmName: string;
  readonly profile: FarmerProfile;
  readonly cropCodes: readonly CropCode[];
}

export interface AppSnapshot {
  readonly identity: FarmIdentity;
  readonly summary: ProfitLossSummary;
  readonly transactions: readonly FarmTransaction[];
}

interface IdentityRow {
  profile_id: string;
  name: string;
  phone: string;
  province: string;
  district: string;
  village: string;
  total_area_square_meters: number;
  is_cks_registered: number | null;
  farm_id: string;
  farm_name: string;
}

export async function loadFarmIdentity(db: SqlDatabase): Promise<FarmIdentity | null> {
  const row = await db.first<IdentityRow>(
    `SELECT p.id AS profile_id, p.name, p.phone, p.province, p.district, p.village,
            p.total_area_square_meters, p.is_cks_registered,
            f.id AS farm_id, f.display_name AS farm_name
       FROM farmer_profiles p
       JOIN farms f ON f.owner_local_id = p.id
      WHERE p.deleted_at IS NULL AND f.deleted_at IS NULL
      ORDER BY p.created_at ASC
      LIMIT 1`
  );
  if (row === null) return null;

  const crops = await db.all<{ crop_code: string }>(
    `SELECT crop_code FROM farm_crops
      WHERE farm_id = ? AND deleted_at IS NULL
      ORDER BY created_at ASC`,
    [row.farm_id]
  );

  const cropCodes = crops.map((item) => parseCropCode(item.crop_code));
  const profile = createFarmerProfile({
    id: row.profile_id,
    name: row.name,
    phone: row.phone,
    province: row.province,
    district: row.district,
    village: row.village,
    totalAreaSquareMeters: squareMetersFromStoredValue(row.total_area_square_meters),
    cropCodes,
    ...(row.is_cks_registered === null ? {} : { isCksRegistered: row.is_cks_registered === 1 })
  });

  return {
    farmId: row.farm_id,
    farmName: row.farm_name,
    profile,
    cropCodes: profile.cropCodes
  };
}

export async function loadAppSnapshot(db: SqlDatabase): Promise<AppSnapshot | null> {
  const identity = await loadFarmIdentity(db);
  if (identity === null) return null;
  const repository = new LocalFarmRepository(db);
  const transactions = await repository.listTransactions(identity.farmId);
  const summary = summarizeProfitLoss(transactions);
  return { identity, transactions, summary };
}
