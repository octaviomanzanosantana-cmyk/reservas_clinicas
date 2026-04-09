"use client";

import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
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
  review_sent_at?: string | null;
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
  change_requested: "Reprogramada",
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

function isFutureAppointment(appointment: AppointmentRow): boolean {
  if (!appointment.scheduled_at) return false;

  const scheduledAt = new Date(appointment.scheduled_at);
  if (Number.isNaN(scheduledAt.getTime())) return false;

  return scheduledAt.getTime() > Date.now();
}

function getAppointmentStatusLabel(status: string): string {
  return APPOINTMENT_STATUS_LABELS[status] ?? status;
}

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case "confirmed":
    case "completed":
      return "bg-[var(--badge-confirmed-bg)] text-[var(--badge-confirmed-text)]";
    case "pending":
    case "change_requested":
      return "bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]";
    case "cancelled":
      return "bg-[var(--badge-cancelled-bg)] text-[var(--badge-cancelled-text)]";
    default:
      return "bg-[var(--badge-cancelled-bg)] text-[var(--badge-cancelled-text)]";
  }
}

export function ClinicDashboardPage({
  clinicSlug = PANEL_CLINIC_SLUG,
  basePath = "/clinic",
}: ClinicDashboardPageProps) {
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [clinicHours, setClinicHours] = useState<ClinicHourRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingAppointmentToken, setUpdatingAppointmentToken] = useState<string | null>(null);
  const [completedFeedback, setCompletedFeedback] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

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

        const [servicesResponse, hoursResponse, appointmentsResponse] = await Promise.all([
          fetch(`/api/services?clinicSlug=${clinicSlug}`),
          fetch(`/api/clinic-hours?clinicSlug=${clinicSlug}`),
          fetch(`/api/appointments/by-clinic?clinicSlug=${encodeURIComponent(clinicSlug)}`),
        ]);

        const [servicesData, hoursData, appointmentsData] = await Promise.all([
          servicesResponse.json(),
          hoursResponse.json(),
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
      appointments
        .filter(
          (appointment) =>
            appointment.status !== "completed" &&
            appointment.status !== "cancelled" &&
            isFutureAppointment(appointment),
        )
        .sort((left, right) => getAppointmentTimestamp(left) - getAppointmentTimestamp(right))
        .slice(0, 5),
    [appointments],
  );
  const recentHistoryAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            appointment.status === "completed" ||
            appointment.status === "cancelled" ||
            appointment.status === "change_requested" ||
            !isFutureAppointment(appointment),
        )
        .sort((left, right) => {
          const leftTime = new Date(left.updated_at).getTime() || 0;
          const rightTime = new Date(right.updated_at).getTime() || 0;
          return rightTime - leftTime;
        })
        .slice(0, 10),
    [appointments],
  );

  const handleCopyAppointmentLink = async (token: string) => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.appoclick.com";
      await navigator.clipboard.writeText(`${baseUrl.replace(/\/+$/, "")}/a/${token}`);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Silenciar error de clipboard
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
      const data = (await response.json()) as {
        appointment?: AppointmentRow;
        error?: string;
        calendarWarning?: string | null;
      };

      if (!response.ok || !data.appointment) {
        throw new Error(data.error ?? "No se pudo actualizar la cita");
      }

      setAppointments((current) =>
        current.map((appointment) =>
          appointment.token === token
            ? {
                ...appointment,
                ...data.appointment!,
              }
            : appointment,
        ),
      );

      if (status === "completed") {
        setCompletedFeedback("Marcada como asistida. Email de reseña enviado.");
        setTimeout(() => setCompletedFeedback(null), 4000);
      }

      if (data.calendarWarning) {
        setErrorMessage(
          `La cita se actualizo, pero Google Calendar no se pudo sincronizar: ${data.calendarWarning}`,
        );
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo actualizar la cita");
    } finally {
      setUpdatingAppointmentToken(null);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-7">
        {loading ? (
          <p className="text-sm text-muted">Cargando clínica...</p>
        ) : clinic ? (
          <div className="max-w-3xl space-y-4">
            <div className="space-y-4">
              {clinic.logo_url ? (
                <img src={clinic.logo_url} alt={clinic.name} className="h-14 object-contain" />
              ) : null}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                  Vista general
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  {clinic.name}
                </h1>
                {clinic.description ? (
                  <p className="max-w-2xl text-sm leading-7 text-muted md:text-[15px]">
                    {clinic.description}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 text-sm text-muted sm:grid-cols-2">
                {clinic.address ? (
                  <div className="rounded-[14px] border border-border bg-background px-4 py-3">
                    {clinic.address}
                  </div>
                ) : null}
                {clinic.phone ? (
                  <div className="rounded-[14px] border border-border bg-background px-4 py-3">
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

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[14px] border-[0.5px] border-border bg-card p-5">
          <p className="text-sm text-muted">Servicios activos</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            {activeServices}
          </p>
        </article>
        <article className="rounded-[14px] border-[0.5px] border-border bg-card p-5">
          <p className="text-sm text-muted">Días activos</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            {activeDays}
          </p>
        </article>
        <article className="rounded-[14px] border-[0.5px] border-border bg-card p-5">
          <p className="text-sm text-muted">Citas de hoy</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            {todayAppointments}
          </p>
        </article>
      </section>

      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Accesos rápidos
            </h2>
            <p className="mt-1 text-sm text-muted">
              Atajos para las tareas más frecuentes del día.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`${basePath}/appointments/new`}
              className="rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover"
            >
              Nueva cita
            </Link>
            <Link
              href={`${basePath}/settings`}
              className="rounded-[10px] border-[0.5px] border-border px-4 py-2.5 font-heading text-sm font-semibold text-muted transition-all duration-150 hover:border-primary/30 hover:text-foreground"
            >
              Configuración
            </Link>
            <Link
              href={`${basePath}/services`}
              className="rounded-[10px] border-[0.5px] border-border px-4 py-2.5 font-heading text-sm font-semibold text-muted transition-all duration-150 hover:border-primary/30 hover:text-foreground"
            >
              Servicios
            </Link>
            <Link
              href={`${basePath}/hours`}
              className="rounded-[10px] border-[0.5px] border-border px-4 py-2.5 font-heading text-sm font-semibold text-muted transition-all duration-150 hover:border-primary/30 hover:text-foreground"
            >
              Horarios
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Próximas citas
            </h2>
            <p className="mt-1 text-sm text-muted">Solo citas futuras.</p>
          </div>
        </div>

        {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}

        <div className="mt-5 overflow-x-auto rounded-[14px] border border-border bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-4 py-3 font-medium">Paciente</th>
                <th className="px-4 py-3 font-medium">Servicio</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Fecha/hora</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Enlace</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {upcomingAppointments.map((appointment) => (
                <tr
                  key={appointment.id}
                  className="text-foreground transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/a/${appointment.token}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {appointment.patient_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{appointment.service}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                        {(appointment as AppointmentRow & { appointment_type?: string }).appointment_type === "revision" ? "Revisión" : "Primera visita"}
                      </span>
                      <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted">
                        {(appointment as AppointmentRow & { modality?: string }).modality === "online" ? "Online" : "Presencial"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {formatAppointmentDate(appointment.scheduled_at, appointment.datetime_label)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClasses(appointment.status)}`}>
                      {getAppointmentStatusLabel(appointment.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void handleCopyAppointmentLink(appointment.token)}
                      className="relative inline-flex items-center text-muted transition-colors hover:text-foreground"
                      title="Copiar enlace de la cita"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                      {copiedToken === appointment.token ? (
                        <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-white">
                          Copiado!
                        </span>
                      ) : null}
                    </button>
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
                          className="rounded-[10px] bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleAppointmentStatusUpdate(appointment.token, "cancelled")
                          }
                          disabled={updatingAppointmentToken === appointment.token}
                          className="rounded-[10px] border-[0.5px] border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
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
                          className="rounded-[10px] bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Asistió
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleAppointmentStatusUpdate(appointment.token, "cancelled")
                          }
                          disabled={updatingAppointmentToken === appointment.token}
                          className="rounded-[10px] border-[0.5px] border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : null}
                    {appointment.status === "completed" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Asistió
                      </span>
                    ) : null}
                    {appointment.status === "cancelled" ? (
                      <span className="text-xs font-medium text-muted">Cancelada</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && upcomingAppointments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No hay citas próximas.</p>
          ) : null}
        </div>
        {completedFeedback ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-primary">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {completedFeedback}
          </p>
        ) : null}
      </section>

      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Historial reciente
            </h2>
            <p className="mt-1 text-sm text-muted">Completadas, canceladas y reprogramadas.</p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-[14px] border border-border bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-4 py-3 font-medium">Paciente</th>
                <th className="px-4 py-3 font-medium">Servicio</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Fecha/hora</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {recentHistoryAppointments.map((appointment) => (
                <tr
                  key={appointment.id}
                  className="text-foreground transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3">{appointment.patient_name}</td>
                  <td className="px-4 py-3">{appointment.service}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                        {(appointment as AppointmentRow & { appointment_type?: string }).appointment_type === "revision" ? "Revisión" : "Primera visita"}
                      </span>
                      <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted">
                        {(appointment as AppointmentRow & { modality?: string }).modality === "online" ? "Online" : "Presencial"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {formatAppointmentDate(appointment.scheduled_at, appointment.datetime_label)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClasses(appointment.status)}`}>
                      {getAppointmentStatusLabel(appointment.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {appointment.review_sent_at ? (
                        <span title="Email de reseña enviado">⭐️</span>
                      ) : null}
                      {appointment.status === "completed" || appointment.status === "cancelled" ? (
                        <button
                          type="button"
                          onClick={() => void handleAppointmentStatusUpdate(appointment.token, "confirmed")}
                          disabled={updatingAppointmentToken === appointment.token}
                          className="text-xs text-muted underline transition-colors hover:text-foreground disabled:opacity-60"
                        >
                          Revertir
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && recentHistoryAppointments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">
              No hay citas recientes en el historial.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}


