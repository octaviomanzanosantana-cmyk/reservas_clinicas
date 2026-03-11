import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ClinicHourRow = {
  id: string;
  clinic_slug: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
};

export async function getClinicHoursByClinicSlug(clinicSlug: string): Promise<ClinicHourRow[]> {
  const safeClinicSlug = clinicSlug.trim();
  if (!safeClinicSlug) return [];

  const { data, error } = await supabaseAdmin
    .from("clinic_hours")
    .select("id, clinic_slug, day_of_week, start_time, end_time, active")
    .eq("clinic_slug", safeClinicSlug)
    .eq("active", true)
    .order("day_of_week", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ClinicHourRow[]) ?? [];
}
