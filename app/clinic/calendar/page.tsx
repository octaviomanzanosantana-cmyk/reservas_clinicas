"use client";

import Link from "next/link";
import { buildDaySlotsFromTimeRange, formatTimeLabel } from "@/lib/availability";
import { useEffect, useMemo, useState } from "react";

type ClinicData = {
  name: string;
};

type ClinicHourRow = {
  id: string;
  clinic_slug: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
};

type AppointmentRow = {
  id: number;
  token: string;
  patient_name: string;
  service: string;
  scheduled_at: string | null;
  datetime_label: string;
  status: string;
  updated_at: string;
};

const STATUS_META: Record<
  string,
  {
    label: string;
    className: string;
    accentClassName: string;
  }
> = {
  pending: {
    label: "Pendiente",
    className: "bg-amber-100 text-amber-700",
    accentClassName: "bg-amber-400",
  },
  confirmed: {
    label: "Confirmada",
    className: "bg-emerald-100 text-emerald-700",
    accentClassName: "bg-emerald-500",
  },
  cancelled: {
    label: "Cancelada",
    className: "bg-red-100 text-red-700",
    accentClassName: "bg-red-500",
  },
  completed: {
    label: "Completada",
    className: "bg-slate-100 text-slate-700",
    accentClassName: "bg-slate-400",
  },
  change_requested: {
    label: "Cambio solicitado",
    className: "bg-blue-100 text-blue-700",
    accentClassName: "bg-blue-500",
  },
};

const WEEK_DAYS = [
  { dayOfWeek: 1, label: "Lunes" },
  { dayOfWeek: 2, label: "Martes" },
  { dayOfWeek: 3, label: "Miércoles" },
  { dayOfWeek: 4, label: "Jueves" },
  { dayOfWeek: 5, label: "Viernes" },
] as const;

function getTodayInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(dateInput: string): Date | null {
  const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getScheduleForDate(date: Date, clinicHours: ClinicHourRow[]): ClinicHourRow | null {
  const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
  return clinicHours.find((item) => item.day_of_week === dayOfWeek) ?? null;
}

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

function getSlotKey(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function getStatusMeta(status: string) {
  return (
    STATUS_META[status] ?? {
      label: status,
      className: "bg-slate-100 text-slate-700",
      accentClassName: "bg-slate-400",
    }
  );
}

export default function ClinicCalendarPage() {
  const clinicSlug = "pilarcastillo";
  const [selectedDate, setSelectedDate] = useState(getTodayInputValue());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [clinicHours, setClinicHours] = useState<ClinicHourRow[]>([]);
  const [appointmentsByDate, setAppointmentsByDate] = useState<Record<string, AppointmentRow[]>>({});
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shiftSelectedDate = (days: number) => {
    const baseDate = parseDateInput(selectedDate) ?? new Date();
    const nextDate = new Date(baseDate);
    nextDate.setDate(nextDate.getDate() + days);
    setSelectedDate(formatDateInput(nextDate));
  };

  useEffect(() => {
    let active = true;

    const loadBase = async () => {
      setLoadingBase(true);
      setErrorMessage(null);

      try {
        const [clinicResponse, clinicHoursResponse] = await Promise.all([
          fetch(`/api/clinics?slug=${clinicSlug}`),
          fetch(`/api/clinic-hours?clinicSlug=${clinicSlug}`),
        ]);
        const [clinicData, clinicHoursData] = await Promise.all([
          clinicResponse.json(),
          clinicHoursResponse.json(),
        ]);

        if (!active) return;

        if (!clinicResponse.ok || !clinicData.clinic) {
          throw new Error(clinicData.error ?? "No se pudo cargar la clínica");
        }

        if (!clinicHoursResponse.ok) {
          throw new Error(clinicHoursData.error ?? "No se pudieron cargar los horarios");
        }

        setClinic(clinicData.clinic as ClinicData);
        setClinicHours((clinicHoursData.clinicHours ?? []) as ClinicHourRow[]);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar la agenda");
      } finally {
        if (active) {
          setLoadingBase(false);
        }
      }
    };

    void loadBase();

    return () => {
      active = false;
    };
  }, []);

  const selectedDateObject = useMemo(() => parseDateInput(selectedDate), [selectedDate]);
  const currentDaySchedule = useMemo(() => {
    if (!selectedDateObject) return null;
    return getScheduleForDate(selectedDateObject, clinicHours);
  }, [clinicHours, selectedDateObject]);

  const weekDates = useMemo(
    () => (selectedDateObject ? getWeekDates(selectedDateObject) : []),
    [selectedDateObject],
  );

  useEffect(() => {
    let active = true;

    const loadAppointments = async () => {
      if (!clinic?.name || !selectedDateObject) return;

      setLoadingAppointments(true);
      setErrorMessage(null);

      try {
        const datesToLoad =
          viewMode === "week" ? weekDates.map((date) => formatDateInput(date)) : [selectedDate];

        const responses = await Promise.all(
          datesToLoad.map((date) =>
            fetch(
              `/api/appointments/by-date?clinicName=${encodeURIComponent(clinic.name)}&date=${date}`,
            ),
          ),
        );
        const payloads = await Promise.all(responses.map((response) => response.json()));

        if (!active) return;

        const nextAppointmentsByDate: Record<string, AppointmentRow[]> = {};

        responses.forEach((response, index) => {
          const date = datesToLoad[index];
          const data = payloads[index] as { appointments?: AppointmentRow[]; error?: string };

          if (!response.ok) {
            throw new Error(data.error ?? "No se pudieron cargar las citas");
          }

          nextAppointmentsByDate[date] = (data.appointments ?? []) as AppointmentRow[];
        });

        setAppointmentsByDate(nextAppointmentsByDate);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar las citas");
      } finally {
        if (active) {
          setLoadingAppointments(false);
        }
      }
    };

    void loadAppointments();

    return () => {
      active = false;
    };
  }, [clinic?.name, selectedDate, selectedDateObject, viewMode, weekDates]);

  const appointments = appointmentsByDate[selectedDate] ?? [];

  const agendaSlots = useMemo(() => {
    if (!selectedDateObject || !currentDaySchedule || !currentDaySchedule.active) {
      return [];
    }

    return buildDaySlotsFromTimeRange(
      selectedDateObject,
      currentDaySchedule.start_time,
      currentDaySchedule.end_time,
      15,
    );
  }, [currentDaySchedule, selectedDateObject]);

  const appointmentsBySlot = useMemo(() => {
    const map = new Map<string, AppointmentRow>();

    for (const appointment of appointments) {
      if (!appointment.scheduled_at) continue;

      const scheduledAt = new Date(appointment.scheduled_at);
      if (Number.isNaN(scheduledAt.getTime())) continue;

      map.set(getSlotKey(scheduledAt), appointment);
    }

    return map;
  }, [appointments]);

  const weekAgendaData = useMemo(() => {
    const schedules = weekDates.map((date) => ({
      date,
      dateKey: formatDateInput(date),
      schedule: getScheduleForDate(date, clinicHours),
    }));

    const allSlots = schedules.flatMap((item) => {
      if (!item.schedule || !item.schedule.active) return [];

      return buildDaySlotsFromTimeRange(
        item.date,
        item.schedule.start_time,
        item.schedule.end_time,
        15,
      );
    });

    const uniqueSlotLabels = Array.from(new Set(allSlots.map((slot) => formatTimeLabel(slot)))).sort();

    return {
      schedules,
      timeLabels: uniqueSlotLabels,
    };
  }, [clinicHours, weekDates]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Calendario {viewMode === "day" ? "diario" : "semanal"}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {clinic?.name ?? "Cargando clínica..."}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => shiftSelectedDate(viewMode === "day" ? -1 : -7)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(getTodayInputValue())}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => shiftSelectedDate(viewMode === "day" ? 1 : 7)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Siguiente
              </button>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  viewMode === "day" ? "bg-gray-900 text-white" : "text-gray-700"
                }`}
              >
                Día
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  viewMode === "week" ? "bg-gray-900 text-white" : "text-gray-700"
                }`}
              >
                Semana
              </button>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Fecha</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="mt-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {loadingBase || loadingAppointments ? (
          <p className="text-sm text-gray-600">Cargando agenda...</p>
        ) : errorMessage ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : viewMode === "day" ? (
          !currentDaySchedule || !currentDaySchedule.active ? (
            <p className="text-sm text-gray-600">La clínica no atiende ese día.</p>
          ) : (
            <div className="space-y-3">
              {agendaSlots.map((slot) => {
                const slotLabel = formatTimeLabel(slot);
                const appointment = appointmentsBySlot.get(slotLabel);
                const statusMeta = appointment ? getStatusMeta(appointment.status) : null;

                return (
                  <div
                    key={slot.toISOString()}
                    className="grid gap-3 rounded-2xl border border-gray-200 bg-slate-50 p-4 md:grid-cols-[100px_1fr] md:items-center"
                  >
                    <div className="text-sm font-semibold text-gray-900">{slotLabel}</div>
                    {appointment ? (
                      <Link
                        href={`/a/${appointment.token}`}
                        title={`Paciente: ${appointment.patient_name}\nServicio: ${appointment.service}\nEstado: ${statusMeta?.label ?? appointment.status}`}
                        className="flex rounded-xl border border-gray-200 bg-white shadow-sm transition-colors hover:bg-gray-50"
                      >
                        <div
                          className={`w-1.5 shrink-0 rounded-l-xl ${statusMeta?.accentClassName ?? "bg-slate-400"}`}
                        />
                        <div className="block p-3">
                          <p className="text-sm font-semibold text-gray-900">
                            {appointment.patient_name}
                          </p>
                          <p className="mt-1 text-sm text-gray-600">{appointment.service}</p>
                          {statusMeta ? (
                            <span
                              className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}
                            >
                              {statusMeta.label}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-3 text-sm text-gray-400">
                        Libre
                      </div>
                    )}
                  </div>
                );
              })}

              {agendaSlots.length === 0 ? (
                <p className="text-sm text-gray-600">La clínica no atiende ese día.</p>
              ) : null}
            </div>
          )
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <div className="grid min-w-0 w-full grid-cols-[80px_repeat(5,minmax(0,1fr))]">
              <div className="border-b border-gray-200 bg-white p-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Hora
              </div>
              {weekAgendaData.schedules.map((item, index) => {
                const formatter = new Intl.DateTimeFormat("es-ES", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                });

                return (
                  <div
                    key={`${item.dateKey}-${index}`}
                    className="min-w-0 border-b border-l border-gray-200 bg-white p-3 text-sm font-semibold text-gray-900"
                  >
                    {formatter.format(item.date)}
                  </div>
                );
              })}

              {weekAgendaData.timeLabels.length > 0 ? (
                weekAgendaData.timeLabels.map((timeLabel) => (
                  <div key={timeLabel} className="contents">
                    <div className="border-b border-gray-200 bg-slate-50 p-3 text-sm font-medium text-gray-700">
                      {timeLabel}
                    </div>
                    {weekAgendaData.schedules.map((item) => {
                      const daySlots =
                        item.schedule && item.schedule.active
                          ? buildDaySlotsFromTimeRange(
                              item.date,
                              item.schedule.start_time,
                              item.schedule.end_time,
                              15,
                            )
                          : [];
                      const slotExists = daySlots.some((slot) => formatTimeLabel(slot) === timeLabel);
                      const appointment =
                        (appointmentsByDate[item.dateKey] ?? []).find((entry) => {
                          if (!entry.scheduled_at) return false;
                          const scheduledAt = new Date(entry.scheduled_at);
                          return !Number.isNaN(scheduledAt.getTime()) && getSlotKey(scheduledAt) === timeLabel;
                        }) ?? null;
                      const statusMeta = appointment ? getStatusMeta(appointment.status) : null;

                      return (
                        <div
                          key={`${item.dateKey}-${timeLabel}`}
                          className="min-w-0 border-b border-l border-gray-200 bg-white p-2"
                        >
                          {!slotExists ? null : appointment ? (
                            <Link
                              href={`/a/${appointment.token}`}
                              title={`Paciente: ${appointment.patient_name}\nServicio: ${appointment.service}\nEstado: ${statusMeta?.label ?? appointment.status}`}
                              className="flex w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-gray-200 bg-slate-50 shadow-sm transition-colors hover:bg-gray-50"
                            >
                              <div
                                className={`w-1 shrink-0 rounded-l-xl ${statusMeta?.accentClassName ?? "bg-slate-400"}`}
                              />
                              <div className="block min-w-0 flex-1 p-2">
                                <p className="truncate text-xs font-semibold text-gray-900">
                                  {appointment.patient_name}
                                </p>
                                <p className="mt-1 truncate text-xs text-gray-600">{appointment.service}</p>
                                {statusMeta ? (
                                  <span
                                    className={`mt-2 inline-flex max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}
                                  >
                                    {statusMeta.label}
                                  </span>
                                ) : null}
                              </div>
                            </Link>
                          ) : (
                            <div className="px-2 py-3 text-center text-xs text-gray-300">Libre</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="col-span-6 p-4 text-sm text-gray-600">
                  La clínica no atiende en esta semana.
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
