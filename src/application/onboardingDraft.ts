import { type CropCode } from "../domain/crops";
import { squareMetersFromUserInput, type AreaUnit } from "../domain/landArea";
import { createFarmerProfile, type FarmerProfile } from "../domain/profile";

export interface OnboardingDraft {
  readonly name: string;
  readonly province: string;
  readonly district: string;
  readonly village: string;
  readonly areaText: string;
  readonly areaUnit: AreaUnit;
  readonly cropCodes: readonly CropCode[];
  readonly isCksRegistered?: boolean;
}

export function toggleCrop(current: readonly CropCode[], crop: CropCode): readonly CropCode[] {
  return current.includes(crop) ? current.filter((value) => value !== crop) : [...current, crop];
}

export function buildProfileFromOnboarding(input: {
  readonly id: string;
  readonly draft: OnboardingDraft;
}): FarmerProfile {
  return createFarmerProfile({
    id: input.id,
    name: input.draft.name,
    province: input.draft.province,
    district: input.draft.district,
    village: input.draft.village,
    totalAreaSquareMeters: squareMetersFromUserInput(input.draft.areaText, input.draft.areaUnit),
    cropCodes: input.draft.cropCodes,
    ...(input.draft.isCksRegistered === undefined
      ? {}
      : { isCksRegistered: input.draft.isCksRegistered })
  });
}
