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

export async function createService(input: {
  clinic_slug: string;
  name: string;
  duration_minutes: number;
  active?: boolean;
}): Promise<ServiceRow> {
  const clinicSlug = input.clinic_slug.trim();
  const name = input.name.trim();

  const { data, error } = await supabaseAdmin
    .from("services")
    .insert({
      clinic_slug: clinicSlug,
      name,
      duration_minutes: input.duration_minutes,
      active: input.active ?? true,
    })
    .select("id, clinic_slug, name, duration_minutes, active")
    .single<ServiceRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear el servicio");
  }

  return data;
}

export async function updateServiceById(
  id: string,
  input: Partial<Pick<ServiceRow, "name" | "duration_minutes" | "active">>,
): Promise<ServiceRow | null> {
  const safeId = id.trim();
  if (!safeId) return null;

  const payload = {
    ...(typeof input.name === "string" ? { name: input.name.trim() } : {}),
    ...(typeof input.duration_minutes === "number"
      ? { duration_minutes: input.duration_minutes }
      : {}),
    ...(typeof input.active === "boolean" ? { active: input.active } : {}),
  };

  const { data, error } = await supabaseAdmin
    .from("services")
    .update(payload)
    .eq("id", safeId)
    .select("id, clinic_slug, name, duration_minutes, active")
    .maybeSingle<ServiceRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? null;
}
