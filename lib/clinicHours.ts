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

/** Returns only active hours for a clinic (used by availability logic). */
export async function getClinicHoursByClinicSlug(clinicSlug: string): Promise<ClinicHourRow[]> {
  const safeClinicSlug = clinicSlug.trim();
  if (!safeClinicSlug) return [];

  const { data, error } = await supabaseAdmin
    .from("clinic_hours")
    .select("id, clinic_slug, day_of_week, start_time, end_time, active")
    .eq("clinic_slug", safeClinicSlug)
    .eq("active", true)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ClinicHourRow[]) ?? [];
}

/** Returns ALL hours (active + inactive) for the config UI. */
export async function getClinicHoursConfigByClinicSlug(clinicSlug: string): Promise<ClinicHourRow[]> {
  const safeClinicSlug = clinicSlug.trim();
  if (!safeClinicSlug) return [];

  const { data, error } = await supabaseAdmin
    .from("clinic_hours")
    .select("id, clinic_slug, day_of_week, start_time, end_time, active")
    .eq("clinic_slug", safeClinicSlug)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data as ClinicHourRow[]) ?? [];
}

/** Create a new time slot for a day. */
export async function createClinicHour(input: {
  clinic_slug: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}): Promise<ClinicHourRow> {
  const { data, error } = await supabaseAdmin
    .from("clinic_hours")
    .insert({
      clinic_slug: input.clinic_slug.trim(),
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      end_time: input.end_time,
      active: input.active,
    })
    .select("id, clinic_slug, day_of_week, start_time, end_time, active")
    .single<ClinicHourRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo crear el tramo horario");
  }

  return data;
}

/** Update an existing time slot by ID. */
export async function updateClinicHour(
  id: string,
  input: Partial<Pick<ClinicHourRow, "start_time" | "end_time" | "active">>,
): Promise<ClinicHourRow> {
  const { data, error } = await supabaseAdmin
    .from("clinic_hours")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, clinic_slug, day_of_week, start_time, end_time, active")
    .single<ClinicHourRow>();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar el tramo horario");
  }

  return data;
}

/** Delete a time slot by ID. */
export async function deleteClinicHour(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("clinic_hours")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Legacy upsert — used by seed scripts. Inserts or updates by matching
 * clinic_slug + day_of_week. When multiple slots exist for the same day,
 * this updates the first match or inserts a new row.
 */
export async function upsertClinicHour(input: {
  clinic_slug: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
}): Promise<ClinicHourRow> {
  const clinicSlug = input.clinic_slug.trim();

  // Check if a row already exists for this day
  const { data: existing } = await supabaseAdmin
    .from("clinic_hours")
    .select("id")
    .eq("clinic_slug", clinicSlug)
    .eq("day_of_week", input.day_of_week)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return updateClinicHour(existing.id, {
      start_time: input.start_time,
      end_time: input.end_time,
      active: input.active,
    });
  }

  return createClinicHour(input);
}
