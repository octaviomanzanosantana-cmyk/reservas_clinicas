import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ClinicBlock = {
  id: string;
  clinic_id: string;
  start_date: string; // ISO YYYY-MM-DD
  end_date: string;
  reason: string | null;
  created_at: string;
  created_by: string | null;
};

function today(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Bloqueos activos o futuros (end_date >= hoy), ordenados por start_date asc.
 */
export async function listClinicBlocks(clinicId: string): Promise<ClinicBlock[]> {
  const safeId = clinicId.trim();
  if (!safeId) return [];

  const { data, error } = await supabaseAdmin
    .from("clinic_blocks")
    .select("*")
    .eq("clinic_id", safeId)
    .gte("end_date", today())
    .order("start_date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ClinicBlock[];
}

/**
 * Todos los bloqueos que intersectan con el rango [rangeStart, rangeEnd].
 * Se usa para filtrar en memoria un calendario de rango sin hacer
 * una query por día.
 */
export async function listClinicBlocksInRange(
  clinicId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<ClinicBlock[]> {
  const safeId = clinicId.trim();
  if (!safeId) return [];

  // Intersección: block.end >= rangeStart AND block.start <= rangeEnd
  const { data, error } = await supabaseAdmin
    .from("clinic_blocks")
    .select("*")
    .eq("clinic_id", safeId)
    .gte("end_date", rangeStart)
    .lte("start_date", rangeEnd);

  if (error) throw new Error(error.message);
  return (data ?? []) as ClinicBlock[];
}

export async function createClinicBlock(
  clinicId: string,
  startDate: string,
  endDate: string,
  reason: string | null,
  createdBy: string | null,
): Promise<ClinicBlock> {
  if (!clinicId.trim()) throw new Error("clinic_id requerido");
  if (!startDate || !endDate) throw new Error("Fechas requeridas");
  if (endDate < startDate) throw new Error("La fecha fin debe ser igual o posterior a la fecha inicio");

  const { data, error } = await supabaseAdmin
    .from("clinic_blocks")
    .insert({
      clinic_id: clinicId.trim(),
      start_date: startDate,
      end_date: endDate,
      reason: reason?.trim() || null,
      created_by: createdBy?.trim() || null,
    })
    .select("*")
    .single<ClinicBlock>();

  if (error || !data) throw new Error(error?.message ?? "No se pudo crear el bloqueo");
  return data;
}

export async function deleteClinicBlock(blockId: string, clinicId: string): Promise<void> {
  const safeBlockId = blockId.trim();
  const safeClinicId = clinicId.trim();
  if (!safeBlockId || !safeClinicId) throw new Error("block_id y clinic_id requeridos");

  const { error } = await supabaseAdmin
    .from("clinic_blocks")
    .delete()
    .eq("id", safeBlockId)
    .eq("clinic_id", safeClinicId);

  if (error) throw new Error(error.message);
}

/**
 * Cuenta citas no canceladas dentro del rango [startDate, endDate] inclusive.
 * Usado para avisar a la clínica si bloquea un periodo con citas ya reservadas.
 */
export async function countAppointmentsInBlockRange(
  clinicId: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const safeId = clinicId.trim();
  if (!safeId || !startDate || !endDate) return 0;

  const startIso = `${startDate}T00:00:00.000Z`;
  // endDate es inclusive → buscar hasta el fin del día
  const endInclusive = new Date(`${endDate}T00:00:00.000Z`);
  endInclusive.setUTCDate(endInclusive.getUTCDate() + 1);
  const endIso = endInclusive.toISOString();

  const { count, error } = await supabaseAdmin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", safeId)
    .neq("status", "cancelled")
    .gte("scheduled_at", startIso)
    .lt("scheduled_at", endIso);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * ¿La fecha (YYYY-MM-DD) cae dentro de algún bloqueo activo?
 */
export async function isClinicDateBlocked(clinicId: string, date: string): Promise<boolean> {
  const safeId = clinicId.trim();
  if (!safeId || !date) return false;

  const { data, error } = await supabaseAdmin
    .from("clinic_blocks")
    .select("id")
    .eq("clinic_id", safeId)
    .lte("start_date", date)
    .gte("end_date", date)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

/**
 * Dada una lista de bloques, devuelve true si la fecha cae dentro de alguno.
 * Helper puro para filtrar en memoria después de `listClinicBlocksInRange`.
 */
export function isDateCoveredByBlocks(blocks: ClinicBlock[], date: string): boolean {
  if (!date) return false;
  return blocks.some((b) => b.start_date <= date && b.end_date >= date);
}

/**
 * Expande un rango de bloques en un array de fechas YYYY-MM-DD
 * dentro de [rangeStart, rangeEnd]. Útil para enviar al cliente del
 * calendario público y que desactive esos días visualmente.
 */
export function expandBlocksToDates(
  blocks: ClinicBlock[],
  rangeStart: string,
  rangeEnd: string,
): string[] {
  const set = new Set<string>();
  for (const block of blocks) {
    const start = block.start_date < rangeStart ? rangeStart : block.start_date;
    const end = block.end_date > rangeEnd ? rangeEnd : block.end_date;

    const cursor = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(`${end}T00:00:00.000Z`);
    while (cursor.getTime() <= endDate.getTime()) {
      const y = cursor.getUTCFullYear();
      const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
      const d = String(cursor.getUTCDate()).padStart(2, "0");
      set.add(`${y}-${m}-${d}`);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return [...set].sort();
}
