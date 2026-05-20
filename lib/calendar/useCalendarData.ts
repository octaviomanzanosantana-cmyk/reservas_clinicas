"use client";

import { useCallback, useEffect, useState } from "react";

export type ClinicData = {
  name: string;
  plan?: string | null;
  is_pilot?: boolean | null;
};

export type ClinicHourRow = {
  id: string;
  clinic_slug: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
};

export type AppointmentRow = {
  id: number;
  token: string;
  patient_name: string;
  patient_email?: string | null;
  patient_phone: string | null;
  service: string;
  modality?: string | null;
  appointment_type?: string | null;
  scheduled_at: string | null;
  datetime_label: string;
  status: string;
  video_link?: string | null;
  updated_at: string;
};

export type UseCalendarDataParams = {
  clinicSlug: string;
  startDate: string;
  endDate: string;
};

export type UseCalendarDataResult = {
  clinic: ClinicData | null;
  clinicHours: ClinicHourRow[];
  appointmentsByDate: Record<string, AppointmentRow[]>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

function formatDateInput(date: Date): string {
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

export function useCalendarData({
  clinicSlug,
  startDate,
  endDate,
}: UseCalendarDataParams): UseCalendarDataResult {
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [clinicHours, setClinicHours] = useState<ClinicHourRow[]>([]);
  const [appointmentsByDate, setAppointmentsByDate] = useState<
    Record<string, AppointmentRow[]>
  >({});
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    if (!clinicSlug) return;
    let active = true;

    const loadBase = async () => {
      setLoadingBase(true);
      setError(null);

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
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar la agenda");
      } finally {
        if (active) setLoadingBase(false);
      }
    };

    void loadBase();

    return () => {
      active = false;
    };
  }, [clinicSlug]);

  useEffect(() => {
    if (!clinicSlug || !startDate || !endDate) return;
    let active = true;

    const loadAppointments = async () => {
      setLoadingAppointments(true);
      setError(null);

      try {
        const url =
          startDate === endDate
            ? `/api/appointments/by-date?clinicSlug=${encodeURIComponent(clinicSlug)}&date=${startDate}`
            : `/api/appointments/by-date?clinicSlug=${encodeURIComponent(clinicSlug)}&from=${startDate}&to=${endDate}`;

        const response = await fetch(url);
        const data = (await response.json()) as {
          appointments?: AppointmentRow[];
          error?: string;
        };

        if (!active) return;

        if (!response.ok) {
          throw new Error(data.error ?? "No se pudieron cargar las citas");
        }

        const appointments = (data.appointments ?? []) as AppointmentRow[];
        const grouped: Record<string, AppointmentRow[]> = {};

        const startD = parseDateInput(startDate);
        const endD = parseDateInput(endDate);
        if (startD && endD) {
          const cursor = new Date(startD);
          while (cursor.getTime() <= endD.getTime()) {
            grouped[formatDateInput(cursor)] = [];
            cursor.setDate(cursor.getDate() + 1);
          }
        }

        for (const apt of appointments) {
          if (!apt.scheduled_at) continue;
          const dt = new Date(apt.scheduled_at);
          if (Number.isNaN(dt.getTime())) continue;
          const dateKey = formatDateInput(dt);
          if (!grouped[dateKey]) grouped[dateKey] = [];
          grouped[dateKey].push(apt);
        }

        setAppointmentsByDate(grouped);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "No se pudieron cargar las citas");
      } finally {
        if (active) setLoadingAppointments(false);
      }
    };

    void loadAppointments();

    return () => {
      active = false;
    };
  }, [clinicSlug, startDate, endDate, reloadCounter]);

  const refetch = useCallback(() => setReloadCounter((c) => c + 1), []);

  return {
    clinic,
    clinicHours,
    appointmentsByDate,
    loading: loadingBase || loadingAppointments,
    error,
    refetch,
  };
}
