"use client";

import { EditPatientModal } from "@/components/clinic/EditPatientModal";
import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { canUseFeature } from "@/lib/plan";
import type { Plan } from "@/lib/plan";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ClinicData = {
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  theme_color: string | null;
  plan: string;
  dpa_accepted_at: string | null;
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
  patient_email?: string | null;
  patient_phone?: string | null;
  service: string;
  scheduled_at: string | null;
  datetime_label: string;
  video_link?: string | null;
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
  const [editingAppointment, setEditingAppointment] = useState<AppointmentRow | null>(null);
  const [editFeedback, setEditFeedback] = useState<string | null>(null);

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
  const monthlyAppointmentCount = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return appointments.filter((a) => {
      const created = new Date(a.updated_at);
      return created >= monthStart;
    }).length;
  }, [appointments]);

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
        .slice(0, 5),
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

  const handleSavePatient = useCallback(async (data: {
    token: string;
    patient_name: string;
    patient_email: string | null;
    patient_phone: string | null;
    modality: string;
    video_link: string | null;
  }) => {
    const response = await fetch("/api/appointments/update-patient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = (await response.json()) as { appointment?: AppointmentRow; error?: string };

    if (!response.ok || !result.appointment) {
      throw new Error(result.error ?? "No se pudo actualizar");
    }

    setAppointments((current) =>
      current.map((a) => (a.token === data.token ? { ...a, ...result.appointment! } : a)),
    );
    setEditingAppointment(null);
    setEditFeedback("Datos actualizados correctamente");
    setTimeout(() => setEditFeedback(null), 4000);
  }, []);

  return (
    <div className="space-y-8">
      {editingAppointment ? (
        <EditPatientModal
          appointment={editingAppointment}
          clinicPlan={clinic?.plan ?? "free"}
          basePath={basePath}
          formatDate={formatAppointmentDate}
          onSave={handleSavePatient}
          onClose={() => setEditingAppointment(null)}
        />
      ) : null}

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

      {clinic && !clinic.dpa_accepted_at ? (
        <section className="rounded-[14px] border-[0.5px] border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-800">
            📋 Tienes un contrato pendiente de firmar. Para cumplir con el RGPD, acepta el DPA antes de continuar usando AppoClick con pacientes reales.
          </p>
          <Link
            href="/dpa"
            className="mt-3 inline-block text-sm font-semibold text-[#0E9E82] hover:underline"
          >
            Ver y aceptar el DPA →
          </Link>
        </section>
      ) : null}

      {clinic?.plan === "free" && monthlyAppointmentCount >= 40 ? (
        <section className={`rounded-[14px] border-[0.5px] p-5 ${
          monthlyAppointmentCount >= 50
            ? "border-red-200 bg-red-50"
            : "border-amber-200 bg-amber-50"
        }`}>
          <div className="flex items-center justify-between gap-3">
            <p className={`text-sm font-medium ${monthlyAppointmentCount >= 50 ? "text-red-800" : "text-amber-800"}`}>
              {monthlyAppointmentCount >= 50
                ? "Has alcanzado tu límite de 50 citas este mes."
                : `Este mes: ${monthlyAppointmentCount}/50 citas · Te quedan ${50 - monthlyAppointmentCount}`}
            </p>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min((monthlyAppointmentCount / 50) * 100, 100)}%`,
                backgroundColor: monthlyAppointmentCount >= 50 ? "#EF4444" : "#F59E0B",
              }}
            />
          </div>
          <p className="mt-3 text-xs">
            <Link
              href={`${basePath}/plan`}
              className="text-[#0E9E82] font-medium hover:underline"
            >
              {monthlyAppointmentCount >= 50
                ? "Actualiza a Starter para seguir recibiendo reservas →"
                : "Actualiza a Starter para citas ilimitadas →"}
            </Link>
          </p>
        </section>
      ) : null}

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
                    <button
                      type="button"
                      onClick={() => setEditingAppointment(appointment)}
                      className="font-medium text-[#0E9E82] cursor-pointer transition-colors hover:underline"
                    >
                      {appointment.patient_name}
                    </button>
                    {!appointment.patient_email ? (
                      <span
                        className="ml-1.5 inline-flex rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-muted"
                        title={canUseFeature(clinic?.plan as Plan, "whatsapp") ? "Sin email — recuerda enviar el recordatorio por WhatsApp" : "Sin email — el paciente no recibirá comunicaciones automáticas"}
                      >
                        Sin email
                      </span>
                    ) : null}
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
                    <div className="flex items-center gap-2">
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
                      {canUseFeature(clinic?.plan as Plan, "whatsapp") ? (
                      <a
                        href={(() => {
                          const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.appoclick.com";
                          const link = `${baseUrl.replace(/\/+$/, "")}/a/${appointment.token}`;
                          const clinicName = clinic?.name ?? "la clínica";
                          const address = clinic?.address ?? "";
                          const mod = (appointment as AppointmentRow & { modality?: string }).modality;
                          const isOnline = mod === "online";
                          const locationLine = isOnline
                            ? (appointment.video_link
                              ? "💻 Consulta online"
                              : "💻 Consulta online (recibirás el enlace próximamente)")
                            : address ? `📍 ${address}` : "";
                          const videoLine = isOnline && appointment.video_link ? `🎥 Enlace de consulta: ${appointment.video_link}` : "";
                          const msg = [
                            `Hola ${appointment.patient_name}, te confirmamos tu cita con ${clinicName}:`,
                            "",
                            `📅 ${formatAppointmentDate(appointment.scheduled_at, appointment.datetime_label)}`,
                            locationLine,
                            videoLine,
                            "",
                            `Gestiona tu cita aquí:`,
                            link,
                            "",
                            `— ${clinicName}`,
                          ].filter(Boolean).join("\n");
                          return `https://wa.me/?text=${encodeURIComponent(msg)}`;
                        })()}
                        target="_blank"
                        rel="noreferrer"
                        title="Enviar por WhatsApp"
                        className="inline-flex items-center transition-opacity hover:opacity-70"
                      >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="#25D366">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.533 5.847L.057 23.882l6.19-1.453A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.876 9.876 0 01-5.031-1.378l-.361-.214-3.741.878.936-3.629-.235-.373A9.859 9.859 0 012.106 12C2.106 6.58 6.58 2.106 12 2.106S21.894 6.58 21.894 12 17.42 21.894 12 21.894z"/>
                        </svg>
                      </a>
                      ) : null}
                    </div>
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
        {editFeedback ? (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-primary">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {editFeedback}
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

        <div className="mt-4 text-center">
          <Link
            href={`${basePath}/patients`}
            className="text-sm font-medium text-[#0E9E82] hover:underline"
          >
            Ver historial completo →
          </Link>
        </div>
      </section>
    </div>
  );
}


