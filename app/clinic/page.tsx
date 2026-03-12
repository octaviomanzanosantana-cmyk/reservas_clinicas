"use client";

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
  service: string;
  scheduled_at: string | null;
  datetime_label: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | string;
  updated_at: string;
};

type GoogleStatusResponse = {
  connected?: boolean;
  authorized?: boolean;
  error?: string;
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

export default function ClinicDashboardPage() {
  const clinicSlug = "pilarcastillo";
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
            fetch("/api/google/status"),
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
        setGoogleConnected(
          Boolean(
            (googleData as GoogleStatusResponse).connected ??
              (googleData as GoogleStatusResponse).authorized,
          ),
        );
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
  }, []);

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

  const handleDisconnectGoogle = async () => {
    setDisconnectingGoogle(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/google/disconnect", {
        method: "POST",
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
          appointment.token === token ? { ...appointment, status: data.appointment!.status } : appointment,
        ),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo actualizar la cita");
    } finally {
      setUpdatingAppointmentToken(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-600">Cargando clínica...</p>
        ) : clinic ? (
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              {clinic.logo_url ? (
                <img src={clinic.logo_url} alt={clinic.name} className="h-14 object-contain" />
              ) : null}
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
                  {clinic.name}
                </h1>
                {clinic.description ? (
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                    {clinic.description}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                {clinic.address ? <p>{clinic.address}</p> : null}
                {clinic.phone ? <p>{clinic.phone}</p> : null}
              </div>
            </div>

            <div
              className="h-20 w-20 rounded-2xl border"
              style={{
                backgroundColor: clinic.theme_color ?? "#f8fafc",
                borderColor: clinic.theme_color ?? "#e5e7eb",
              }}
            />
          </div>
        ) : (
          <p className="text-sm text-red-600">{errorMessage ?? "No se pudo cargar la clínica"}</p>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Servicios activos</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{activeServices}</p>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Días activos</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{activeDays}</p>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Citas de hoy</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{todayAppointments}</p>
        </article>
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Google Calendar</p>
          {googleConnected ? (
            <>
              <p className="mt-2 text-lg font-semibold text-gray-900">Conectado ✓</p>
              <button
                type="button"
                onClick={() => void handleDisconnectGoogle()}
                disabled={disconnectingGoogle}
                className="mt-3 inline-block rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {disconnectingGoogle ? "Desconectando..." : "Desconectar"}
              </button>
            </>
          ) : (
            <a
              href="/api/google/connect"
              className="mt-3 inline-block rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              Conectar Google Calendar
            </a>
          )}
        </article>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Accesos rápidos</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/clinic/settings"
            className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-black"
          >
            Configuración
          </Link>
          <Link
            href="/clinic/services"
            className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-black"
          >
            Servicios
          </Link>
          <Link
            href="/clinic/hours"
            className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-black"
          >
            Horarios
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Próximas citas</h2>
          <p className="text-sm text-gray-500">{appointments.length} cargadas</p>
        </div>

        {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
                <tr className="text-left text-gray-500">
                  <th className="px-3 py-2 font-medium">Paciente</th>
                  <th className="px-3 py-2 font-medium">Servicio</th>
                  <th className="px-3 py-2 font-medium">Fecha/hora</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.map((appointment) => (
                  <tr key={appointment.id} className="text-gray-700">
                  <td className="px-3 py-3">
                    <Link href={`/a/${appointment.token}`} className="text-blue-600 hover:underline">
                      {appointment.patient_name}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{appointment.service}</td>
                  <td className="px-3 py-3">
                    {formatAppointmentDate(appointment.scheduled_at, appointment.datetime_label)}
                  </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {appointment.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {appointment.status === "pending" ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void handleAppointmentStatusUpdate(appointment.token, "confirmed")}
                            disabled={updatingAppointmentToken === appointment.token}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleAppointmentStatusUpdate(appointment.token, "cancelled")}
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
                            onClick={() => void handleAppointmentStatusUpdate(appointment.token, "completed")}
                            disabled={updatingAppointmentToken === appointment.token}
                            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Completar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleAppointmentStatusUpdate(appointment.token, "cancelled")}
                            disabled={updatingAppointmentToken === appointment.token}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : null}
                      {appointment.status === "completed" ? (
                        <span className="text-xs font-medium text-gray-500">Completada</span>
                      ) : null}
                      {appointment.status === "cancelled" ? (
                        <span className="text-xs font-medium text-gray-500">Cancelada</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
          </table>

          {!loading && appointments.length === 0 ? (
            <p className="px-3 py-6 text-sm text-gray-600">No hay citas próximas.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
