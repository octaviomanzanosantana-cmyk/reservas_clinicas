export type Plan = "free" | "starter" | "pro";

export type Feature =
  | "booking"
  | "email_confirmation"
  | "reminders"
  | "whatsapp"
  | "calendar"
  | "video_link"
  | "unlimited_appointments"
  | "white_label"
  | "custom_domain"
  | "private_video_room";

const PLAN_FEATURES: Record<Plan, Feature[]> = {
  free: ["booking", "email_confirmation"],
  starter: [
    "booking",
    "email_confirmation",
    "reminders",
    "whatsapp",
    "calendar",
    "video_link",
    "unlimited_appointments",
  ],
  pro: [
    "booking",
    "email_confirmation",
    "reminders",
    "whatsapp",
    "calendar",
    "video_link",
    "unlimited_appointments",
    "white_label",
    "custom_domain",
    "private_video_room",
  ],
};

export function canUseFeature(plan: Plan | null | undefined, feature: Feature): boolean {
  const resolved = resolvePlan(plan);
  return PLAN_FEATURES[resolved]?.includes(feature) ?? false;
}

export function getPlanFeatures(
  plan: Plan | null | undefined,
  context?: { clinicId?: string | null },
): Feature[] {
  if (plan == null) {
    console.warn("clinic.plan is NULL for clinic:", context?.clinicId ?? "unknown");
  }
  return PLAN_FEATURES[resolvePlan(plan)] ?? PLAN_FEATURES.free;
}

function resolvePlan(plan: Plan | null | undefined): Plan {
  if (plan === "starter" || plan === "pro" || plan === "free") return plan;
  return "free";
}
