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

const WEEK_DAYS = [
  { dayOfWeek: 1, label: "Lunes" },
  { dayOfWeek: 2, label: "Martes" },
  { dayOfWeek: 3, label: "Miércoles" },
  { dayOfWeek: 4, label: "Jueves" },
  { dayOfWeek: 5, label: "Viernes" },
] as const;

function getWeekDates(baseDate: Date): Date[] {
  const dayOfWeek = baseDate.getDay() === 0 ? 7 : baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (dayOfWeek - 1));

  return WEEK_DAYS.map((_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

type WeekViewProps = {
  selectedDate: string;
  basePath: string;
  clinicHours: ClinicHourRow[];
  appointmentsByDate: Record<string, AppointmentRow[]>;
  onAppointmentClick: (appointment: AppointmentRow) => void;
};

export function WeekView({
  selectedDate,
  basePath,
  clinicHours,
  appointmentsByDate,
  onAppointmentClick,
}: WeekViewProps) {
  const selectedDateObject = useMemo(
    () => parseDateInput(selectedDate),
    [selectedDate],
  );

  const weekDates = useMemo(
    () => (selectedDateObject ? getWeekDates(selectedDateObject) : []),
    [selectedDateObject],
  );

  const weekAgendaData = useMemo(() => {
    const schedules = weekDates.map((date) => ({
      date,
      dateKey: formatDateInput(date),
      daySchedules: getSchedulesForDate(date, clinicHours),
    }));

    const allSlots = schedules.flatMap((item) => {
      const activeSchedules = item.daySchedules.filter((s) => s.active);
      if (activeSchedules.length === 0) return [];

      return activeSchedules.flatMap((schedule) =>
        buildDaySlotsFromTimeRange(
          item.date,
          schedule.start_time,
          schedule.end_time,
          15,
        ),
      );
    });

    const uniqueSlotLabels = Array.from(
      new Set(allSlots.map((slot) => formatTimeLabel(slot))),
    ).sort();

    return {
      schedules,
      timeLabels: uniqueSlotLabels,
    };
  }, [clinicHours, weekDates]);

  return (
    <div className="min-w-0 overflow-x-auto rounded-[24px] border border-slate-200 bg-slate-50/60">
      <div className="grid min-w-0 w-full grid-cols-[88px_repeat(5,minmax(0,1fr))]">
        <div className="border-b border-slate-200 bg-white/90 p-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Hora
        </div>
        {weekAgendaData.schedules.map((item, index) => {
          const formatter = new Intl.DateTimeFormat("es-ES", {
            weekday: "long",
            day: "2-digit",
            month: "2-digit",
          });
          const isInactive =
            item.daySchedules.length === 0 ||
            !item.daySchedules.some((s) => s.active);

          return (
            <div
              key={`${item.dateKey}-${index}`}
              className={`min-w-0 border-b border-l border-slate-200 p-3 text-sm font-semibold ${
                isInactive
                  ? "bg-slate-100 text-slate-400"
                  : "bg-white/90 text-slate-900"
              }`}
            >
              {formatter.format(item.date)}
            </div>
          );
        })}

        {weekAgendaData.timeLabels.length > 0 ? (
          weekAgendaData.timeLabels.map((timeLabel) => (
            <div key={timeLabel} className="contents">
              <div className="border-b border-slate-200 bg-slate-50/90 p-3 text-sm font-medium text-slate-700">
                {timeLabel}
              </div>
              {weekAgendaData.schedules.map((item) => {
                const activeSchedules = item.daySchedules.filter(
                  (s) => s.active,
                );
                const daySlots = activeSchedules.flatMap((schedule) =>
                  buildDaySlotsFromTimeRange(
                    item.date,
                    schedule.start_time,
                    schedule.end_time,
                    15,
                  ),
                );
                const slotExists = daySlots.some(
                  (slot) => formatTimeLabel(slot) === timeLabel,
                );
                const slotAppointments = (appointmentsByDate[item.dateKey] ?? []).filter((entry) => {
                  if (!entry.scheduled_at) return false;
                  const scheduledAt = new Date(entry.scheduled_at);
                  return (
                    !Number.isNaN(scheduledAt.getTime()) &&
                    getSlotKey(scheduledAt) === timeLabel
                  );
                });

                const isDayInactive =
                  item.daySchedules.length === 0 ||
                  !item.daySchedules.some((s) => s.active);

                return (
                  <div
                    key={`${item.dateKey}-${timeLabel}`}
                    className={`min-w-0 border-b border-l border-slate-200 p-2 ${isDayInactive ? "bg-slate-50" : "bg-white"}`}
                  >
                    {!slotExists ? null : slotAppointments.length > 0 ? (
                      <div className="space-y-1.5">
                        {slotAppointments.map((appointment) => (
                          <AppointmentCard
                            key={appointment.token}
                            appointment={appointment}
                            variant="compact"
                            onClick={onAppointmentClick}
                          />
                        ))}
                      </div>
                    ) : (
                      <Link
                        href={`${basePath}/appointments/new?date=${item.dateKey}&time=${timeLabel}`}
                        className="block rounded-[18px] border border-dashed border-transparent px-2 py-3 text-center text-xs text-slate-300 transition-all duration-150 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-500"
                      >
                        Libre
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          <div className="col-span-6 p-5 text-sm text-slate-600">
            La clínica no atiende en esta semana.
          </div>
        )}
      </div>
    </div>
  );
}
