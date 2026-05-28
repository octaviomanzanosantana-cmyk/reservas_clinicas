"use client";

import Link from "next/link";
import { useMemo } from "react";

import { AppointmentCard } from "@/components/clinic/calendar/AppointmentCard";
import { buildDaySlotsFromTimeRange, formatTimeLabel } from "@/lib/availability";
import {
  formatDateInput,
  getSchedulesForDate,
  getSlotKey,
  parseDateInput,
} from "@/lib/calendar/dateHelpers";
import type {
  AppointmentRow,
  ClinicHourRow,
} from "@/lib/calendar/useCalendarData";

type DayViewProps = {
  selectedDate: string;
  basePath: string;
  clinicHours: ClinicHourRow[];
  appointments: AppointmentRow[];
  onAppointmentClick: (appointment: AppointmentRow) => void;
};

export function DayView({
  selectedDate,
  basePath,
  clinicHours,
  appointments,
  onAppointmentClick,
}: DayViewProps) {
  const selectedDateObject = useMemo(
    () => parseDateInput(selectedDate),
    [selectedDate],
  );

  const currentDaySchedules = useMemo(() => {
    if (!selectedDateObject) return [];
    return getSchedulesForDate(selectedDateObject, clinicHours);
  }, [clinicHours, selectedDateObject]);

  const agendaSlots = useMemo(() => {
    if (!selectedDateObject || currentDaySchedules.length === 0) {
      return [];
    }

    const activeSchedules = currentDaySchedules.filter((s) => s.active);
    if (activeSchedules.length === 0) return [];

    const allSlots: Date[] = [];
    for (const schedule of activeSchedules) {
      allSlots.push(
        ...buildDaySlotsFromTimeRange(
          selectedDateObject,
          schedule.start_time,
          schedule.end_time,
          15,
        ),
      );
    }

    return [...new Map(allSlots.map((s) => [s.getTime(), s])).values()].sort(
      (a, b) => a.getTime() - b.getTime(),
    );
  }, [currentDaySchedules, selectedDateObject]);

  const appointmentsBySlot = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();

    for (const appointment of appointments) {
      if (!appointment.scheduled_at) continue;

      const scheduledAt = new Date(appointment.scheduled_at);
      if (Number.isNaN(scheduledAt.getTime())) continue;

      const key = getSlotKey(scheduledAt);
      const existing = map.get(key);
      if (existing) {
        existing.push(appointment);
      } else {
        map.set(key, [appointment]);
      }
    }

    return map;
  }, [appointments]);

  if (
    currentDaySchedules.length === 0 ||
    !currentDaySchedules.some((s) => s.active)
  ) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center text-sm text-slate-600">
        La clínica no atiende ese día.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agendaSlots.map((slot) => {
        const slotLabel = formatTimeLabel(slot);
        const slotAppointments = appointmentsBySlot.get(slotLabel) ?? [];

        return (
          <div
            key={slot.toISOString()}
            className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-[112px_1fr] md:items-center"
          >
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold tracking-tight text-slate-900 shadow-sm">
              {slotLabel}
            </div>
            {slotAppointments.length > 0 ? (
              <div className="space-y-2">
                {slotAppointments.map((appointment) => (
                  <AppointmentCard
                    key={appointment.token}
                    appointment={appointment}
                    variant="regular"
                    onClick={onAppointmentClick}
                  />
                ))}
              </div>
            ) : (
              <Link
                href={`${basePath}/appointments/new?date=${selectedDateObject ? formatDateInput(selectedDateObject) : selectedDate}&time=${slotLabel}`}
                className="rounded-[22px] border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-400 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600"
              >
                Libre
              </Link>
            )}
          </div>
        );
      })}

      {agendaSlots.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center text-sm text-slate-600">
          La clínica no atiende ese día.
        </div>
      ) : null}
    </div>
  );
}
