import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ServiceRow = {
  id: string;
  clinic_slug: string;
  name: string;
  duration_minutes: number;
  active: boolean;
};

export async function getActiveServicesByClinicSlug(clinicSlug: string): Promise<ServiceRow[]> {
  const safeClinicSlug = clinicSlug.trim();
  if (!safeClinicSlug) return [];

  const { data, error } = await supabaseAdmin
    .from("services")
    .select("id, clinic_slug, name, duration_minutes, active")
    .eq("clinic_slug", safeClinicSlug)
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ServiceRow[]) ?? [];
}

export async function getServiceByClinicSlugAndName(
  clinicSlug: string,
  serviceName: string,
): Promise<ServiceRow | null> {
  const safeClinicSlug = clinicSlug.trim();
  const safeServiceName = serviceName.trim();
  if (!safeClinicSlug || !safeServiceName) return null;

  const { data, error } = await supabaseAdmin
    .from("services")
    .select("id, clinic_slug, name, duration_minutes, active")
    .eq("clinic_slug", safeClinicSlug)
    .eq("name", safeServiceName)
    .eq("active", true)
    .maybeSingle<ServiceRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}
