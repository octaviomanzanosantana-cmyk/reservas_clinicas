import "server-only";

import type { AppointmentRow } from "@/lib/appointments";
import { getAvailableSlotsForClinicDate } from "@/lib/clinicAvailability";
import { buildDateTimeLabel } from "@/lib/dateFormat";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SlotValidationResult = { ok: true } | { ok: false; reason: string };

export async function validateSlotAvailable(params: {
  clinicSlug: string;
  scheduledAt: Date;
  service?: string | null;
  excludeToken?: string;
}): Promise<SlotValidationResult> {
  const slots = await getAvailableSlotsForClinicDate({
    clinicSlug: params.clinicSlug,
    date: params.scheduledAt,
    service: params.service,
    excludeToken: params.excludeToken,
  });

  if (slots.length === 0) {
    return {
      ok: false,
      reason: "Ese día no hay disponibilidad (clínica cerrada o bloqueada por vacaciones)",
    };
  }

  const requestedIso = params.scheduledAt.toISOString();
  const slotMatch = slots.some((slot) => slot.value === requestedIso);

  if (!slotMatch) {
    return { ok: false, reason: "Ese horario ya está ocupado o no encaja con los horarios de la clínica" };
  }

  return { ok: true };
}

export function regenerateDatetimeLabel(scheduledAt: Date, timezone?: string | null): string {
  return buildDateTimeLabel(scheduledAt, timezone ?? undefined);
}

export type ApplyRescheduleParams = {
  token: string;
  newScheduledAt: Date;
  datetimeLabel: string;
  updatedByClinicUserId?: string | null;
  resetReminder: boolean;
};

export async function applyRescheduleUpdate(
  params: ApplyRescheduleParams,
): Promise<AppointmentRow> {
  const update: Record<string, unknown> = {
    scheduled_at: params.newScheduledAt.toISOString(),
    datetime_label: params.datetimeLabel,
    updated_at: new Date().toISOString(),
  };

  if (params.resetReminder) {
    update.reminder_sent_at = null;
  }

  if (params.updatedByClinicUserId !== undefined) {
    update.updated_by_clinic_user_id = params.updatedByClinicUserId;
  }

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .update(update)
    .eq("token", params.token)
    .select("*")
    .maybeSingle<AppointmentRow>();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("No se pudo actualizar la cita");
  }
  return data;
}
