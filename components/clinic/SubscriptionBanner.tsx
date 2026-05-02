import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  calculateBannerState,
  type ClinicSubscriptionInfo,
} from "@/lib/subscriptionBannerState";
import SubscriptionBannerClient from "./SubscriptionBannerClient";

type Props = {
  clinicId: string;
};

export default async function SubscriptionBanner({ clinicId }: Props) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("clinics")
    .select(
      "subscription_status, is_pilot, trial_ends_at, plan_expires_at, stripe_subscription_id, plan"
    )
    .eq("id", clinicId)
    .maybeSingle();

  // Si hay error o no hay datos, fail-silent (no romper el panel)
  if (error || !data) return null;

  const clinic: ClinicSubscriptionInfo = {
    subscription_status: data.subscription_status,
    is_pilot: data.is_pilot,
    trial_ends_at: data.trial_ends_at,
    plan_expires_at: data.plan_expires_at,
    stripe_subscription_id: data.stripe_subscription_id,
    plan: data.plan,
  };

  const state = calculateBannerState(clinic);
  if (!state) return null;

  return <SubscriptionBannerClient state={state} />;
}
