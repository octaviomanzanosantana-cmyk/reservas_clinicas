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

export function canUseFeature(plan: Plan, feature: Feature): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false;
}

export function getPlanFeatures(plan: Plan): Feature[] {
  return PLAN_FEATURES[plan] ?? PLAN_FEATURES.free;
}
