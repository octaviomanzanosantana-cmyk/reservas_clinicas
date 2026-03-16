"use client";

import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import {
  isGoogleCalendarConnected,
  type GoogleCalendarStatus,
} from "@/lib/googleCalendarStatus";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ClinicData = {
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  theme_color: string | null;
};

type ServiceRow = {
  id: string;
  clinic_slug: string;
  name: string;
  duration_minutes: number;
  active: boolean;
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
  patient_phone?: string | null;
  service: string;
  scheduled_at: string | null;
  datetime_label: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | string;
  updated_at: string;
};

type ClinicDashboardPageProps = {
  clinicSlug?: string;
  basePath?: string;
};

const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Asistió",
  change_requested: "Cambio solicitado",
};

function isTodayLocal(value: string | null): boolean {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatAppointmentDate(value: string | null, fallback: string): string {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getAppointmentTimestamp(appointment: AppointmentRow): number {
  const date = new Date(appointment.scheduled_at ?? appointment.updated_at);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getAppointmentStatusLabel(status: string): string {
  return APPOINTMENT_STATUS_LABELS[status] ?? status;
}

export function ClinicDashboardPage({
  clinicSlug = PANEL_CLINIC_SLUG,
  basePath = "/clinic",
}: ClinicDashboardPageProps) {
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [clinicHours, setClinicHours] = useState<ClinicHourRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [updatingAppointmentToken, setUpdatingAppointmentToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const clinicResponse = await fetch(`/api/clinics?slug=${clinicSlug}`);
        const clinicData = await clinicResponse.json();

        if (!clinicResponse.ok || !clinicData.clinic) {
          throw new Error(clinicData.error ?? "No se pudo cargar la clínica");
        }

        const clinicName = clinicData.clinic.name as string;

        const [servicesResponse, hoursResponse, googleResponse, appointmentsResponse] =
          await Promise.all([
            fetch(`/api/services?clinicSlug=${clinicSlug}`),
            fetch(`/api/clinic-hours?clinicSlug=${clinicSlug}`),
            fetch(`/api/google/status?clinicSlug=${encodeURIComponent(clinicSlug)}`),
            fetch(`/api/appointments/by-clinic?clinicName=${encodeURIComponent(clinicName)}`),
          ]);

        const [servicesData, hoursData, googleData, appointmentsData] = await Promise.all([
          servicesResponse.json(),
          hoursResponse.json(),
          googleResponse.json(),
          appointmentsResponse.json(),
        ]);

        if (!active) return;

        setClinic(clinicData.clinic as ClinicData);
        setServices(servicesResponse.ok ? ((servicesData.services ?? []) as ServiceRow[]) : []);
        setClinicHours(hoursResponse.ok ? ((hoursData.clinicHours ?? []) as ClinicHourRow[]) : []);
        setAppointments(
          appointmentsResponse.ok
            ? ((appointmentsData.appointments ?? []) as AppointmentRow[])
            : [],
        );
        setGoogleConnected(isGoogleCalendarConnected(googleData as GoogleCalendarStatus));
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar el dashboard");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [clinicSlug]);

  const activeServices = useMemo(
    () => services.filter((service) => service.active).length,
    [services],
  );
  const activeDays = useMemo(
    () => clinicHours.filter((hour) => hour.active).length,
    [clinicHours],
  );
  const todayAppointments = useMemo(
    () => appointments.filter((appointment) => isTodayLocal(appointment.scheduled_at)).length,
    [appointments],
  );
  const upcomingAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.status !== "completed" && appointment.status !== "cancelled",
      ),
    [appointments],
  );
  const recentHistoryAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            appointment.status === "completed" || appointment.status === "cancelled",
        )
        .sort((left, right) => getAppointmentTimestamp(right) - getAppointmentTimestamp(left)),
    [appointments],
  );

  const handleDisconnectGoogle = async () => {
    setDisconnectingGoogle(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/google/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clinicSlug }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo desconectar Google Calendar");
      }

      setGoogleConnected(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo desconectar Google Calendar",
      );
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  const handleAppointmentStatusUpdate = async (
    token: string,
    status: "confirmed" | "cancelled" | "completed",
  ) => {
    setUpdatingAppointmentToken(token);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/appointments/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          status,
        }),
      });
      const data = (await response.json()) as { appointment?: AppointmentRow; error?: string };

      if (!response.ok || !data.appointment) {
        throw new Error(data.error ?? "No se pudo actualizar la cita");
      }

      setAppointments((current) =>
        current.map((appointment) =>
          appointment.token === token
            ? { ...appointment, status: data.appointment!.status }
            : appointment,
        ),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo actualizar la cita");
    } finally {
      setUpdatingAppointmentToken(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] border border-white/70 bg-white/90 p-7 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.38)]">
        {loading ? (
          <p className="text-sm text-slate-600">Cargando clínica...</p>
        ) : clinic ? (
          <div className="max-w-3xl space-y-4">
            <div className="space-y-4">
              {clinic.logo_url ? (
                <img src={clinic.logo_url} alt={clinic.name} className="h-14 object-contain" />
              ) : null}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Vista general
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                  {clinic.name}
                </h1>
                {clinic.description ? (
                  <p className="max-w-2xl text-sm leading-7 text-slate-600 md:text-[15px]">
                    {clinic.description}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                {clinic.address ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    {clinic.address}
                  </div>
                ) : null}
                {clinic.phone ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    {clinic.phone}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-600">{errorMessage ?? "No se pudo cargar la clínica"}</p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.4)]">
          <p className="text-sm text-slate-500">Servicios activos</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {activeServices}
          </p>
        </article>
        <article className="rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.4)]">
          <p className="text-sm text-slate-500">Días activos</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {activeDays}
          </p>
        </article>
        <article className="rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.4)]">
          <p className="text-sm text-slate-500">Citas de hoy</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {todayAppointments}
          </p>
        </article>
        <article className="rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.4)]">
          <p className="text-sm text-slate-500">Google Calendar</p>
          {googleConnected ? (
            <>
              <p className="mt-3 text-lg font-semibold text-slate-900">Conectado ✓</p>
              <button
                type="button"
                onClick={() => void handleDisconnectGoogle()}
                disabled={disconnectingGoogle}
                className="mt-4 inline-flex rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {disconnectingGoogle ? "Desconectando..." : "Desconectar"}
              </button>
            </>
          ) : (
            <a
              href={`/api/google/connect?clinicSlug=${encodeURIComponent(clinicSlug)}`}
              className="mt-4 inline-flex rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-150 hover:bg-black"
            >
              Conectar Google Calendar
            </a>
          )}
        </article>
      </section>

      <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.38)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Accesos rápidos
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Atajos para las tareas más frecuentes del día.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`${basePath}/appointments/new`}
              className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_32px_-24px_rgba(15,23,42,0.8)] transition-all duration-150 hover:bg-black"
            >
              Nueva cita
            </Link>
            <Link
              href={`${basePath}/settings`}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-100"
            >
              Configuración
            </Link>
            <Link
              href={`${basePath}/services`}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-100"
            >
              Servicios
            </Link>
            <Link
              href={`${basePath}/hours`}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-100"
            >
              Horarios
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.38)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Próximas citas
            </h2>
            <p className="mt-1 text-sm text-slate-500">{upcomingAppointments.length} cargadas</p>
          </div>
        </div>

        {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}

        <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200 bg-slate-50/70">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Paciente</th>
                <th className="px-4 py-3 font-medium">Servicio</th>
                <th className="px-4 py-3 font-medium">Fecha/hora</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {upcomingAppointments.map((appointment) => (
                <tr
                  key={appointment.id}
                  className="text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/a/${appointment.token}`}
                      className="font-medium text-sky-700 hover:underline"
                    >
                      {appointment.patient_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{appointment.service}</td>
                  <td className="px-4 py-3">
                    {formatAppointmentDate(appointment.scheduled_at, appointment.datetime_label)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {appointment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {appointment.status === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handleAppointmentStatusUpdate(appointment.token, "confirmed")
                          }
                          disabled={updatingAppointmentToken === appointment.token}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleAppointmentStatusUpdate(appointment.token, "cancelled")
                          }
                          disabled={updatingAppointmentToken === appointment.token}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : null}
                    {appointment.status === "confirmed" ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handleAppointmentStatusUpdate(appointment.token, "completed")
                          }
                          disabled={updatingAppointmentToken === appointment.token}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Asistió
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleAppointmentStatusUpdate(appointment.token, "cancelled")
                          }
                          disabled={updatingAppointmentToken === appointment.token}
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : null}
                    {appointment.status === "completed" ? (
                      <span className="text-xs font-medium text-slate-500">Asistió</span>
                    ) : null}
                    {appointment.status === "cancelled" ? (
                      <span className="text-xs font-medium text-slate-500">Cancelada</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && upcomingAppointments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-600">No hay citas próximas.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.38)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Historial reciente
            </h2>
            <p className="mt-1 text-sm text-slate-500">{recentHistoryAppointments.length} cargadas</p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200 bg-slate-50/70">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Paciente</th>
                <th className="px-4 py-3 font-medium">Servicio</th>
                <th className="px-4 py-3 font-medium">Fecha/hora</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {recentHistoryAppointments.map((appointment) => (
                <tr
                  key={appointment.id}
                  className="text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3">{appointment.patient_name}</td>
                  <td className="px-4 py-3">{appointment.service}</td>
                  <td className="px-4 py-3">
                    {formatAppointmentDate(appointment.scheduled_at, appointment.datetime_label)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {getAppointmentStatusLabel(appointment.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && recentHistoryAppointments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-600">
              No hay citas recientes en el historial.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default function ClinicDashboardRoute() {
  return <ClinicDashboardPage />;
}
