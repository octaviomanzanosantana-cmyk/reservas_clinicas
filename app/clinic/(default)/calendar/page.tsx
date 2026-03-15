"use client";

import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { buildDaySlotsFromTimeRange, formatTimeLabel } from "@/lib/availability";
import Link from "next/link";
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
  patient_phone: string | null;
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
    label: "Asistió",
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

type ClinicCalendarPageProps = {
  clinicSlug?: string;
  basePath?: string;
};

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

export function ClinicCalendarPage({
  clinicSlug = PANEL_CLINIC_SLUG,
  basePath = "/clinic",
}: ClinicCalendarPageProps) {
  const [selectedDate, setSelectedDate] = useState(getTodayInputValue());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [clinicHours, setClinicHours] = useState<ClinicHourRow[]>([]);
  const [appointmentsByDate, setAppointmentsByDate] = useState<Record<string, AppointmentRow[]>>(
    {},
  );
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
  }, [clinicSlug]);

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

    const uniqueSlotLabels = Array.from(
      new Set(allSlots.map((slot) => formatTimeLabel(slot))),
    ).sort();

    return {
      schedules,
      timeLabels: uniqueSlotLabels,
    };
  }, [clinicHours, weekDates]);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.4)]">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.14),_transparent_38%),linear-gradient(180deg,_rgba(248,250,252,0.95),_rgba(255,255,255,0.98))] p-7 md:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Agenda clínica
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2rem]">
                Calendario {viewMode === "day" ? "diario" : "semanal"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Revisa tu agenda, detecta huecos libres y accede rápido a cada cita desde una vista
                más limpia y legible.
              </p>
              <div className="mt-5 inline-flex rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                {clinic?.name ?? "Cargando clínica..."}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[auto_auto] xl:min-w-[420px]">
              <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/85 p-2 shadow-sm">
                <button
                  type="button"
                  onClick={() => shiftSelectedDate(viewMode === "day" ? -1 : -7)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-white"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(getTodayInputValue())}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-white"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => shiftSelectedDate(viewMode === "day" ? 1 : 7)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-white"
                >
                  Siguiente →
                </button>
              </div>

              <div className="flex flex-col gap-3 sm:items-end">
                <div className="rounded-2xl border border-slate-200 bg-white/85 p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setViewMode("day")}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                      viewMode === "day"
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Día
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("week")}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                      viewMode === "week"
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Semana
                  </button>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Fecha</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="mt-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-300"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.4)]">
        <div className="border-b border-slate-200/80 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                {viewMode === "day" ? "Vista del día" : "Vista de la semana"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Mantén el foco en la agenda sin perder el contexto de horarios y estados.
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 shadow-sm">
              {viewMode === "day" ? "Agenda puntual" : "Semana laboral"}
            </div>
          </div>
        </div>

        <div className="p-6">
          {loadingBase || loadingAppointments ? (
            <p className="text-sm text-slate-600">Cargando agenda...</p>
          ) : errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : viewMode === "day" ? (
            !currentDaySchedule || !currentDaySchedule.active ? (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center text-sm text-slate-600">
                La clínica no atiende ese día.
              </div>
            ) : (
              <div className="space-y-3">
                {agendaSlots.map((slot) => {
                  const slotLabel = formatTimeLabel(slot);
                  const appointment = appointmentsBySlot.get(slotLabel);
                  const statusMeta = appointment ? getStatusMeta(appointment.status) : null;

                  return (
                    <div
                      key={slot.toISOString()}
                      className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-[112px_1fr] md:items-center"
                    >
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold tracking-tight text-slate-900 shadow-sm">
                        {slotLabel}
                      </div>
                      {appointment ? (
                        <Link
                          href={`/a/${appointment.token}`}
                          title={`Paciente: ${appointment.patient_name}\nServicio: ${appointment.service}\nTeléfono: ${appointment.patient_phone?.trim() || "—"}\nEstado: ${statusMeta?.label ?? appointment.status}`}
                          className="flex rounded-[22px] border border-slate-200 bg-white shadow-[0_16px_32px_-26px_rgba(15,23,42,0.45)] transition-all duration-150 hover:border-slate-300 hover:bg-slate-50"
                        >
                          <div
                            className={`w-1.5 shrink-0 rounded-l-[22px] ${statusMeta?.accentClassName ?? "bg-slate-400"}`}
                          />
                          <div className="min-w-0 p-4">
                            <p className="text-sm font-semibold text-slate-900">
                              {appointment.patient_name}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">{appointment.service}</p>
                            {statusMeta ? (
                              <span
                                className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}
                              >
                                {statusMeta.label}
                              </span>
                            ) : null}
                          </div>
                        </Link>
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
            )
          ) : (
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

                  return (
                    <div
                      key={`${item.dateKey}-${index}`}
                      className="min-w-0 border-b border-l border-slate-200 bg-white/90 p-3 text-sm font-semibold text-slate-900"
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
                        const daySlots =
                          item.schedule && item.schedule.active
                            ? buildDaySlotsFromTimeRange(
                                item.date,
                                item.schedule.start_time,
                                item.schedule.end_time,
                                15,
                              )
                            : [];
                        const slotExists = daySlots.some(
                          (slot) => formatTimeLabel(slot) === timeLabel,
                        );
                        const appointment =
                          (appointmentsByDate[item.dateKey] ?? []).find((entry) => {
                            if (!entry.scheduled_at) return false;
                            const scheduledAt = new Date(entry.scheduled_at);
                            return (
                              !Number.isNaN(scheduledAt.getTime()) &&
                              getSlotKey(scheduledAt) === timeLabel
                            );
                          }) ?? null;
                        const statusMeta = appointment ? getStatusMeta(appointment.status) : null;

                        return (
                          <div
                            key={`${item.dateKey}-${timeLabel}`}
                            className="min-w-0 border-b border-l border-slate-200 bg-white p-2"
                          >
                            {!slotExists ? null : appointment ? (
                              <Link
                                href={`/a/${appointment.token}`}
                                title={`Paciente: ${appointment.patient_name}\nServicio: ${appointment.service}\nTeléfono: ${appointment.patient_phone?.trim() || "—"}\nEstado: ${statusMeta?.label ?? appointment.status}`}
                                className="flex w-full min-w-0 max-w-full overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.45)] transition-all duration-150 hover:border-slate-300 hover:bg-white"
                              >
                                <div
                                  className={`w-1 shrink-0 rounded-l-[20px] ${statusMeta?.accentClassName ?? "bg-slate-400"}`}
                                />
                                <div className="min-w-0 flex-1 p-2.5">
                                  <p className="truncate text-xs font-semibold text-slate-900">
                                    {appointment.patient_name}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-slate-600">
                                    {appointment.service}
                                  </p>
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
          )}
        </div>
      </section>
    </div>
  );
}

export default function ClinicCalendarRoute() {
  return <ClinicCalendarPage />;
}
