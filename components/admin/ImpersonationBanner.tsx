import "server-only";

import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ImpersonationBannerClient } from "./ImpersonationBannerClient";

export async function ImpersonationBanner() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value?.trim();
  if (!token) return null;

  const { data: tokenRow } = await supabaseAdmin
    .from("impersonation_tokens")
    .select("clinic_slug, expires_at, used")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow || tokenRow.used) return null;
  if (new Date(tokenRow.expires_at).getTime() < Date.now()) return null;

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("name")
    .eq("slug", tokenRow.clinic_slug)
    .maybeSingle();

  return (
    <ImpersonationBannerClient
      clinicName={clinic?.name ?? tokenRow.clinic_slug}
      expiresAt={tokenRow.expires_at}
    />
  );
}
