import { canUseFeature, getPlanFeatures, type Feature, type Plan } from "./plan.ts";

export type ClinicForFeature = {
  plan: string | null | undefined;
  is_pilot: boolean | null | undefined;
};

const KNOWN_FEATURES: ReadonlySet<Feature> = new Set(getPlanFeatures("pro"));

export function clinicHasFeature(
  clinic: ClinicForFeature,
  feature: Feature,
): boolean {
  if (!KNOWN_FEATURES.has(feature)) return false;
  if (clinic.is_pilot === true) return true;
  return canUseFeature(clinic.plan as Plan | null | undefined, feature);
}
