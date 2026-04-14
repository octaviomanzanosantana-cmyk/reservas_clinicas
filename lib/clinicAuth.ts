import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { redirect } from "next/navigation";

type ClinicUserRow = {
  clinic_id: string;
  role: string;
  clinics: {
    slug: string;
  } | null;
};

export type CurrentClinicAccess = {
  userId: string;
  clinicId: string;
  clinicSlug: string;
  role: string;
};

export class ClinicAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "ClinicAccessError";
    this.status = status;
  }
}

export async function getCurrentClinicForUser(userId: string): Promise<CurrentClinicAccess | null> {
  const safeUserId = userId.trim();
  if (!safeUserId) return null;

  const { data, error } = await supabaseAdmin
    .from("clinic_users")
    .select("clinic_id, role, clinics!inner(slug)")
    .eq("user_id", safeUserId)
    .maybeSingle<ClinicUserRow>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.clinic_id || !data.clinics?.slug) {
    return null;
  }

  return {
    userId: safeUserId,
    clinicId: data.clinic_id,
    clinicSlug: data.clinics.slug,
    role: data.role?.trim() || "owner",
  };
}

export async function getCurrentClinicForRequest(): Promise<CurrentClinicAccess | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id?.trim();
  if (!userId) return null;

  return getCurrentClinicForUser(userId);
}

export async function requireCurrentClinicForRequest(): Promise<CurrentClinicAccess> {
  const access = await getCurrentClinicForRequest();
  if (!access) {
    redirect("/login");
  }

  return access;
}

export async function verifyAdminImpersonationToken(
  token: string,
  clinicSlug: string,
): Promise<boolean> {
  const safeToken = token.trim();
  if (!safeToken) return false;

  const { data } = await supabaseAdmin
    .from("impersonation_tokens")
    .select("*")
    .eq("token", safeToken)
    .eq("clinic_slug", clinicSlug)
    .eq("used", false)
    .maybeSingle();

  if (!data) return false;

  // Check expiry
  if (new Date(data.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from("impersonation_tokens").update({ used: true }).eq("id", data.id);
    return false;
  }

  // Mark as used (single use)
  await supabaseAdmin.from("impersonation_tokens").update({ used: true }).eq("id", data.id);
  return true;
}

export async function requireClinicAccessForSlug(
  clinicSlug: string,
  adminToken?: string | null,
): Promise<CurrentClinicAccess> {
  // Check admin impersonation token first
  if (adminToken) {
    const valid = await verifyAdminImpersonationToken(adminToken, clinicSlug);
    if (valid) {
      return {
        userId: "admin-impersonation",
        clinicId: clinicSlug,
        clinicSlug,
        role: "admin",
      };
    }
  }

  const access = await requireCurrentClinicForRequest();
  const safeSlug = clinicSlug.trim();

  if (access.clinicSlug !== safeSlug) {
    redirect(`/clinic/${access.clinicSlug}`);
  }

  return access;
}

export async function requireCurrentClinicForApi(): Promise<CurrentClinicAccess> {
  const access = await getCurrentClinicForRequest();

  if (!access) {
    throw new ClinicAccessError("No autenticado", 401);
  }

  return access;
}

export async function assertCurrentClinicAccessForApi(input: {
  clinicSlug?: string | null;
  clinicId?: string | null;
}): Promise<CurrentClinicAccess> {
  const access = await requireCurrentClinicForApi();
  const safeSlug = input.clinicSlug?.trim();
  const safeClinicId = input.clinicId?.trim();

  if (safeSlug && access.clinicSlug !== safeSlug) {
    throw new ClinicAccessError("No puedes acceder a otra clinica", 403);
  }

  if (safeClinicId && access.clinicId !== safeClinicId) {
    throw new ClinicAccessError("No puedes operar sobre otra clinica", 403);
  }

  return access;
}
