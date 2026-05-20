"use client";

import { useMemo } from "react";

import { AppointmentCard } from "@/components/clinic/calendar/AppointmentCard";
import {
  formatDateInput,
  getMonthGrid,
  isOperatingDay,
  parseDateInput,
} from "@/lib/calendar/dateHelpers";
import type {
  AppointmentRow,
  ClinicHourRow,
} from "@/lib/calendar/useCalendarData";

const WEEKDAY_LABELS = [
  "Lun",
  "Mar",
  "Mié",
  "Jue",
  "Vie",
  "Sáb",
  "Dom",
] as const;

const MAX_APPOINTMENTS_PER_CELL = 3;

type MonthViewProps = {
  selectedDate: string;
  clinicHours: ClinicHourRow[];
  appointments: AppointmentRow[];
  onAppointmentClick: (appointment: AppointmentRow) => void;
  onDayClick: (dateString: string) => void;
};

export function MonthView({
  selectedDate,
  clinicHours,
  appointments,
  onAppointmentClick,
  onDayClick,
}: MonthViewProps) {
  const selectedDateObject = useMemo(
    () => parseDateInput(selectedDate),
    [selectedDate],
  );

  const grid = useMemo(() => {
    if (!selectedDateObject) return [];
    return getMonthGrid(
      selectedDateObject.getFullYear(),
      selectedDateObject.getMonth() + 1,
    );
  }, [selectedDateObject]);

  const appointmentsByDate = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    for (const apt of appointments) {
      if (!apt.scheduled_at) continue;
      const dt = new Date(apt.scheduled_at);
      if (Number.isNaN(dt.getTime())) continue;
      const key = formatDateInput(dt);
      if (!map[key]) map[key] = [];
      map[key].push(apt);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        const at = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
        const bt = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
        return at - bt;
      });
    }
    return map;
  }, [appointments]);

  if (!selectedDateObject) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center text-sm text-slate-600">
        Selecciona una fecha válida.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50/60">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-white/90">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="p-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-slate-200">
        {grid.map((day) => {
          const dayAppointments = appointmentsByDate[day.dateString] ?? [];
          const visible = dayAppointments.slice(0, MAX_APPOINTMENTS_PER_CELL);
          const overflow = dayAppointments.length - visible.length;
          const operating = isOperatingDay(day.dayOfWeek, clinicHours);
          const dimmed = !day.isCurrentMonth || !operating;

          return (
            <div
              key={day.dateString}
              onClick={() => onDayClick(day.dateString)}
              className={`flex min-h-[96px] cursor-pointer flex-col gap-1 p-1.5 transition-colors ${
                dimmed ? "bg-slate-100" : "bg-white"
              } hover:bg-slate-50`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    day.isToday
                      ? "bg-primary text-white"
                      : dimmed
                        ? "text-slate-400"
                        : "text-slate-900"
                  }`}
                >
                  {day.dayOfMonth}
                </span>
              </div>
              {visible.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {visible.map((apt) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      variant="mini"
                      onClick={onAppointmentClick}
                    />
                  ))}
                </div>
              ) : null}
              {overflow > 0 ? (
                <span className="mt-auto px-1 text-[11px] font-medium text-slate-500">
                  +{overflow} más
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
