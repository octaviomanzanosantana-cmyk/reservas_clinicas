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

export default function ClinicCalendarPage() {
  const clinicSlug = "pilarcastillo";
  const [selectedDate, setSelectedDate] = useState(getTodayInputValue());
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [clinicHours, setClinicHours] = useState<ClinicHourRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    let active = true;

    const loadAppointments = async () => {
      if (!clinic?.name) return;

      setLoadingAppointments(true);
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/appointments/by-date?clinicName=${encodeURIComponent(clinic.name)}&date=${selectedDate}`,
        );
        const data = await response.json();

        if (!active) return;

        if (!response.ok) {
          throw new Error(data.error ?? "No se pudieron cargar las citas");
        }

        setAppointments((data.appointments ?? []) as AppointmentRow[]);
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
  }, [clinic?.name, selectedDate]);

  const selectedDateObject = useMemo(() => parseDateInput(selectedDate), [selectedDate]);
  const currentDaySchedule = useMemo(() => {
    if (!selectedDateObject) return null;
    const dayOfWeek = selectedDateObject.getDay() === 0 ? 7 : selectedDateObject.getDay();
    return clinicHours.find((item) => item.day_of_week === dayOfWeek) ?? null;
  }, [clinicHours, selectedDateObject]);

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

      const key = `${scheduledAt.getHours().toString().padStart(2, "0")}:${scheduledAt
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
      map.set(key, appointment);
    }

    return map;
  }, [appointments]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Calendario diario
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              {clinic?.name ?? "Cargando clínica..."}
            </p>
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
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {loadingBase || loadingAppointments ? (
          <p className="text-sm text-gray-600">Cargando agenda...</p>
        ) : errorMessage ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : !currentDaySchedule || !currentDaySchedule.active ? (
          <p className="text-sm text-gray-600">La clínica no atiende ese día.</p>
        ) : (
          <div className="space-y-3">
            {agendaSlots.map((slot) => {
              const slotLabel = formatTimeLabel(slot);
              const appointment = appointmentsBySlot.get(slotLabel);

              return (
                <div
                  key={slot.toISOString()}
                  className="grid gap-3 rounded-2xl border border-gray-200 bg-slate-50 p-4 md:grid-cols-[100px_1fr] md:items-center"
                >
                  <div className="text-sm font-semibold text-gray-900">{slotLabel}</div>
                  {appointment ? (
                    <Link
                      href={`/a/${appointment.token}`}
                      className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-colors hover:bg-gray-50"
                    >
                      <p className="text-sm font-semibold text-gray-900">
                        {appointment.patient_name}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">{appointment.service}</p>
                      <p className="mt-2 text-xs font-medium text-gray-500">
                        Estado: {appointment.status}
                      </p>
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
        )}
      </section>
    </div>
  );
}
