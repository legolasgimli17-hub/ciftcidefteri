import { parseCropCode, type CropCode } from "../domain/crops";
import { squareMetersFromStoredValue } from "../domain/landArea";
import { createFarmerProfile, type FarmerProfile } from "../domain/profile";
import { type ProfitLossSummary } from "../domain/profitLoss";
import { type FarmTransaction } from "../domain/transaction";
import { type SqlDatabase } from "../storage/sql";
import { parseNullableSqlBoolean } from "../storage/sqlBoolean";
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
  readonly recentTransactions: readonly FarmTransaction[];
}

interface IdentityRow {
  profile_id: string;
  name: string;
  province: string;
  district: string;
  village: string;
  total_area_square_meters: number;
  is_cks_registered: number | null;
  farm_id: string;
  farm_name: string;
}

const HOME_RECENT_TRANSACTION_LIMIT = 4;

export async function loadFarmIdentity(db: SqlDatabase): Promise<FarmIdentity | null> {
  const rows = await db.all<IdentityRow>(
    `SELECT p.id AS profile_id, p.name, p.province, p.district, p.village,
            p.total_area_square_meters, p.is_cks_registered,
            f.id AS farm_id, f.display_name AS farm_name
       FROM farmer_profiles p
       JOIN farms f ON f.owner_local_id = p.id
      WHERE p.deleted_at IS NULL AND f.deleted_at IS NULL
      ORDER BY p.created_at ASC, f.created_at ASC
      LIMIT 2`
  );
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    throw new Error("Yerel veride birden fazla aktif çiftlik bulundu. Yanlış defter açılmadı.");
  }

  const row = rows[0];
  if (row === undefined) return null;
  const crops = await db.all<{ crop_code: string }>(
    `SELECT crop_code FROM farm_crops
      WHERE farm_id = ? AND deleted_at IS NULL
      ORDER BY created_at ASC`,
    [row.farm_id]
  );

  const cropCodes = crops.map((item) => parseCropCode(item.crop_code));
  const isCksRegistered = parseNullableSqlBoolean(row.is_cks_registered, "ÇKS bilgisi");
  const profile = createFarmerProfile({
    id: row.profile_id,
    name: row.name,
    province: row.province,
    district: row.district,
    village: row.village,
    totalAreaSquareMeters: squareMetersFromStoredValue(row.total_area_square_meters),
    cropCodes,
    ...(isCksRegistered === undefined ? {} : { isCksRegistered })
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
  const summary = await repository.profitLoss(identity.farmId);
  const recentTransactions = await repository.listRecentTransactions(
    identity.farmId,
    HOME_RECENT_TRANSACTION_LIMIT
  );

  return { identity, summary, recentTransactions };
}
