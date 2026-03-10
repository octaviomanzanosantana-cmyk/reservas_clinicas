"use client";

import {
  getAppointmentByToken,
  listAppointmentsByClinic,
  type AppointmentRow,
  type CreateAppointmentInput,
} from "@/lib/appointments";
import StatusBadge from "@/components/StatusBadge";
import { getClinicTheme } from "@/lib/clinicTheme";
import { DEMO_TOKENS, getClinicConfig } from "@/lib/demoClinics";
import type { AppointmentStatus } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

const APPOINTMENT_ESTIMATED_VALUE = 80;

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  change_requested: "Cambio solicitado",
  cancelled: "Cancelada",
};

const ACTION_LABEL: Record<AppointmentStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmó cita",
  change_requested: "Solicitó cambio",
  cancelled: "Canceló cita",
};

type CreateFormState = {
  clinic_id: string;
  clinic_name: string;
  patient_name: string;
  service: string;
  scheduled_date: string;
  scheduled_time: string;
  address: string;
  duration_label: string;
};

type ClinicService = {
  id: string;
  clinic_slug: string;
  name: string;
  duration_minutes: number;
  active: boolean;
};

function generateToken(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `cita-${Date.now().toString(36)}-${random}`.toLowerCase();
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateTimeLabel(dateInput: string, timeInput: string): string {
  const date = new Date(`${dateInput}T${timeInput}:00`);
  if (Number.isNaN(date.getTime())) {
    return `${dateInput} · ${timeInput}`;
  }
  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long" }).format(date);
  const weekdayTitle = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
  return `${weekdayTitle} · ${timeInput}`;
}

export default function DemoDashboardPage() {
  const [token, setToken] = useState("demo123");
  const [appointment, setAppointment] = useState<AppointmentRow | null>(null);
  const [clinicAppointments, setClinicAppointments] = useState<AppointmentRow[]>([]);
  const [createdTokens, setCreatedTokens] = useState<string[]>([]);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleAuthUrl, setGoogleAuthUrl] = useState<string | null>(null);
  const [services, setServices] = useState<ClinicService[]>([]);

  const clinic = getClinicConfig(token);
  const theme = getClinicTheme(token);

  const [form, setForm] = useState<CreateFormState>({
    clinic_id: "",
    clinic_name: clinic.clinicName,
    patient_name: "",
    service: clinic.defaultAppointment.service,
    scheduled_date: toDateInputValue(new Date()),
    scheduled_time: "18:00",
    address: clinic.address,
    duration_label: clinic.defaultAppointment.durationLabel,
  });

  const tokenOptions = useMemo(
    () => Array.from(new Set([...DEMO_TOKENS, ...createdTokens])),
    [createdTokens],
  );

  useEffect(() => {
    let active = true;

    const loadServices = async () => {
      try {
        const response = await fetch(`/api/services?clinicSlug=${encodeURIComponent(clinic.clinicSlug)}`);
        const data = (await response.json()) as { services?: ClinicService[] };

        if (!active) return;
        setServices(response.ok ? (data.services ?? []) : []);
      } catch {
        if (!active) return;
        setServices([]);
      }
    };

    void loadServices();

    return () => {
      active = false;
    };
  }, [clinic.clinicSlug]);

  useEffect(() => {
    setForm((prev) => {
      const resolvedService =
        services.find((item) => item.name === prev.service) ??
        (services.length > 0 ? services[0] : null);

      return {
        ...prev,
        clinic_name: clinic.clinicName,
        service: resolvedService?.name ?? prev.service ?? clinic.defaultAppointment.service,
        address: prev.address || clinic.address,
        duration_label:
          resolvedService?.duration_minutes != null
            ? `${resolvedService.duration_minutes} min`
            : prev.duration_label || clinic.defaultAppointment.durationLabel,
      };
    });
  }, [
    clinic.address,
    clinic.clinicName,
    clinic.defaultAppointment.durationLabel,
    clinic.defaultAppointment.service,
    services,
  ]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const next = await getAppointmentByToken(token);
        const scopeClinicName = next?.clinic_name ?? clinic.clinicName;
        const list = await listAppointmentsByClinic(scopeClinicName, 200);

        if (!isMounted) return;
        setAppointment(next);
        setClinicAppointments(list);
      } catch {
        if (!isMounted) return;
        setAppointment(null);
        setClinicAppointments([]);
      }
    };

    load();
    const timer = window.setInterval(load, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [token, clinic.clinicName]);

  useEffect(() => {
    let active = true;
    const loadGoogleStatus = async () => {
      try {
        const [statusResponse, authResponse] = await Promise.all([
          fetch("/api/google/status"),
          fetch("/api/google/auth-url"),
        ]);

        const statusData = await statusResponse.json();
        const authData = await authResponse.json();

        if (!active) return;
        setGoogleConnected(Boolean(statusData.authorized));
        setGoogleAuthUrl(authData.url ?? null);
      } catch {
        if (!active) return;
        setGoogleConnected(false);
        setGoogleAuthUrl(null);
      }
    };

    loadGoogleStatus();
    return () => {
      active = false;
    };
  }, []);

  const appointmentStatus: AppointmentStatus = appointment?.status ?? "pending";

  const scopedAppointments = useMemo(() => {
    if (clinicAppointments.length > 0) return clinicAppointments;
    return appointment ? [appointment] : [];
  }, [appointment, clinicAppointments]);

  const formattedActivity = useMemo(() => {
    if (scopedAppointments.length === 0) return [];

    const formatter = new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });

    return scopedAppointments
      .slice()
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10)
      .map((item) => ({
        patientName: item.patient_name,
        appointmentLabel: item.datetime_label,
        actionLabel: ACTION_LABEL[item.status],
        updatedAtLabel: formatter.format(new Date(item.updated_at)),
        uniqueKey: `${item.id}-${item.updated_at}`,
      }));
  }, [scopedAppointments]);

  const impactMetrics = useMemo(() => {
    const confirmadas = scopedAppointments.filter((item) => item.status === "confirmed").length;
    const cambios = scopedAppointments.filter((item) => item.status === "change_requested").length;
    const canceladas = scopedAppointments.filter((item) => item.status === "cancelled").length;
    const pendientes = scopedAppointments.filter((item) => item.status === "pending").length;
    const llamadasEvitadas = confirmadas + cambios + canceladas;

    const huecosRecuperables = canceladas;
    const ingresosProtegidos = confirmadas * APPOINTMENT_ESTIMATED_VALUE;

    return {
      confirmadas,
      cambios,
      canceladas,
      pendientes,
      llamadasEvitadas,
      huecosRecuperables,
      ingresosProtegidos,
    };
  }, [scopedAppointments]);

  const todayAgenda = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const timeFormatter = new Intl.DateTimeFormat("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return scopedAppointments
      .filter((item) => {
        if (!item.scheduled_at) return false;
        const scheduled = new Date(item.scheduled_at);
        return (
          !Number.isNaN(scheduled.getTime()) &&
          scheduled >= startOfToday &&
          scheduled <= endOfToday
        );
      })
      .sort((a, b) => {
        const aTime = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
        const bTime = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
        return aTime - bTime;
      })
      .map((item) => ({
        id: item.id,
        token: item.token,
        hourLabel: item.scheduled_at
          ? timeFormatter.format(new Date(item.scheduled_at))
          : "--:--",
        patientName: item.patient_name,
        service: item.service,
        status: item.status,
      }));
  }, [scopedAppointments]);

  const patientLink = createdLink ?? (typeof window !== "undefined" ? `${window.location.origin}/a/${token}` : `/a/${token}`);
  const computedDateTimeLabel = buildDateTimeLabel(form.scheduled_date, form.scheduled_time);
  const computedScheduledAt = useMemo(() => {
    const date = new Date(`${form.scheduled_date}T${form.scheduled_time}:00`);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }, [form.scheduled_date, form.scheduled_time]);

  const handleCreateAppointment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCalendarWarning(null);

    try {
      if (!computedScheduledAt) {
        throw new Error("Fecha u hora inválida");
      }

      const newToken = generateToken();
      const payload: CreateAppointmentInput = {
        token: newToken,
        clinic_id: form.clinic_id.trim() || null,
        clinic_name: form.clinic_name.trim(),
        patient_name: form.patient_name.trim(),
        service: form.service.trim(),
        scheduled_at: computedScheduledAt,
        datetime_label: computedDateTimeLabel,
        address: form.address.trim(),
        duration_label: form.duration_label.trim(),
        status: "pending",
      };

      const response = await fetch("/api/appointments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        appointment?: AppointmentRow;
        calendarWarning?: string | null;
        error?: string;
      };

      if (!response.ok || !result.appointment) {
        throw new Error(result.error ?? "No se pudo crear la cita");
      }

      const created = result.appointment;
      const fullLink = `${window.location.origin}/a/${created.token}`;

      setCreatedLink(fullLink);
      setCalendarWarning(result.calendarWarning ?? null);
      setCreatedTokens((prev) => [created.token, ...prev]);
      setToken(created.token);
      setAppointment(created);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "No se pudo crear la cita");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold shadow-sm"
            style={{ backgroundColor: `${theme.accent}1f`, color: theme.accent }}
          >
            {theme.logoText}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Panel de clínica (demo)</h1>
            <p className="mt-1 text-sm text-gray-600">Vista demo para clínicas</p>
          </div>
        </header>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700" htmlFor="token">
                Token de demo
              </label>
              <select
                id="token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                {tokenOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm">
                {googleConnected ? "Google Calendar — Conectado" : "Google Calendar — No conectado"}
              </span>
              {googleConnected ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/google/disconnect", { method: "POST" });
                      if (!response.ok) {
                        throw new Error("No se pudo desconectar Google Calendar");
                      }
                      setGoogleConnected(false);
                    } catch (error) {
                      setCreateError(
                        error instanceof Error ? error.message : "No se pudo desconectar Google Calendar",
                      );
                    }
                  }}
                  className="inline-flex rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-all duration-150 hover:bg-gray-50 active:translate-y-[1px]"
                >
                  Desconectar
                </button>
              ) : googleAuthUrl ? (
                <a
                  href={googleAuthUrl}
                  className="inline-flex rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 shadow-sm transition-all duration-150 hover:bg-amber-100 active:translate-y-[1px]"
                >
                  Conectar Google Calendar
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setShowCreatePanel(true);
                  setCreateError(null);
                }}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-95 active:translate-y-[1px]"
                style={{ backgroundColor: theme.primary }}
              >
                Crear cita
              </button>
            </div>
          </div>

          <p className="mt-2 text-sm text-gray-600">
            Clínica seleccionada: <span className="font-medium text-gray-900">{clinic.clinicName}</span>
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Estado actual: <span className="font-medium text-gray-900">{STATUS_LABEL[appointmentStatus]}</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Métricas calculadas sobre {scopedAppointments.length} citas de la clínica seleccionada.
          </p>
        </section>

        {showCreatePanel ? (
          <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">Nueva cita</h2>
              <button
                type="button"
                onClick={() => setShowCreatePanel(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Clínica"
                placeholder="Ej: Clínica Pilar Castillo"
                value={form.clinic_name}
                onChange={(value) => setForm((prev) => ({ ...prev, clinic_name: value }))}
                required
              />
              <Field
                label="Nombre del paciente"
                placeholder="Ej: Marta García"
                value={form.patient_name}
                onChange={(value) => setForm((prev) => ({ ...prev, patient_name: value }))}
                required
              />
              <SelectField
                label="Servicio"
                value={form.service}
                onChange={(value) => {
                  const selectedService = services.find((item) => item.name === value);
                  setForm((prev) => ({
                    ...prev,
                    service: value,
                    duration_label:
                      selectedService?.duration_minutes != null
                        ? `${selectedService.duration_minutes} min`
                        : prev.duration_label,
                  }));
                }}
                options={
                  services.length > 0
                    ? services.map((item) => ({ value: item.name, label: item.name }))
                    : [{ value: clinic.defaultAppointment.service, label: clinic.defaultAppointment.service }]
                }
                required
              />
              <Field
                label="Fecha"
                type="date"
                value={form.scheduled_date}
                onChange={(value) => setForm((prev) => ({ ...prev, scheduled_date: value }))}
                required
              />
              <Field
                label="Hora"
                type="time"
                value={form.scheduled_time}
                onChange={(value) => setForm((prev) => ({ ...prev, scheduled_time: value }))}
                required
              />
              <Field
                label="Dirección"
                placeholder="Ej: San Bernardo 19, Las Palmas"
                value={form.address}
                onChange={(value) => setForm((prev) => ({ ...prev, address: value }))}
                required
              />
              <Field
                label="Código interno clínica"
                placeholder="Ej: CPC_TEST"
                helper="Opcional para piloto"
                value={form.clinic_id}
                onChange={(value) => setForm((prev) => ({ ...prev, clinic_id: value }))}
              />

              <div className="sm:col-span-2">
                <p className="mb-2 text-xs text-gray-500">
                  Duración estimada: <span className="font-medium text-gray-700">{form.duration_label}</span>
                </p>
                <p className="mb-2 text-xs text-gray-500">
                  Vista previa de cita: <span className="font-medium text-gray-700">{computedDateTimeLabel}</span>
                </p>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-95 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: theme.primary }}
                >
                  {creating ? "Creando..." : "Guardar cita"}
                </button>
              </div>
            </form>

            {createError ? <p className="mt-3 text-sm text-red-600">{createError}</p> : null}
            {createdLink ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
                <p className="text-sm font-semibold text-emerald-900">Cita creada correctamente</p>
                {calendarWarning ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Cita guardada, pero no se pudo crear el evento en Google Calendar: {calendarWarning}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-emerald-700">Evento creado en Google Calendar.</p>
                )}
                <p className="mt-1 text-xs text-emerald-700">Enlace del paciente</p>
                <a
                  href={createdLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block break-all rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm transition-colors hover:bg-emerald-100"
                >
                  {createdLink}
                </a>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(createdLink);
                      } catch {
                        setCreateError("No se pudo copiar el enlace");
                      }
                    }}
                    className="rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-900 shadow-sm transition-all duration-150 hover:bg-emerald-100 active:translate-y-[1px]"
                  >
                    Copiar enlace
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(createdLink, "_blank", "noopener,noreferrer")}
                    className="rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:bg-emerald-800 active:translate-y-[1px]"
                  >
                    Abrir enlace paciente
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Impacto en la agenda</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Confirmadas" value={impactMetrics.confirmadas} accent={theme.accent} />
            <MetricCard label="Cambio solicitado" value={impactMetrics.cambios} accent={theme.accent} />
            <MetricCard label="Canceladas" value={impactMetrics.canceladas} accent={theme.accent} />
            <MetricCard label="Pendientes" value={impactMetrics.pendientes} accent={theme.accent} />
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Impacto económico estimado</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MetricCard label="Huecos recuperables" value={impactMetrics.huecosRecuperables} accent={theme.accent} />
            <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ingresos protegidos estimados</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{impactMetrics.ingresosProtegidos} EUR</p>
              <p className="mt-1 text-xs text-gray-500">Confirmadas x {APPOINTMENT_ESTIMATED_VALUE} EUR</p>
              <p className="mt-2 text-xs text-gray-500">Llamadas evitadas: {impactMetrics.llamadasEvitadas}</p>
              <div className="mt-3 h-1.5 rounded-full" style={{ backgroundColor: `${theme.accent}33` }} />
            </article>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Agenda de hoy</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="px-2 py-2 font-medium">Hora</th>
                  <th className="px-2 py-2 font-medium">Paciente</th>
                  <th className="px-2 py-2 font-medium">Servicio</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {todayAgenda.length > 0 ? (
                  todayAgenda.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="px-2 py-2 text-gray-900">{item.hourLabel}</td>
                      <td className="px-2 py-2 text-gray-900">{item.patientName}</td>
                      <td className="px-2 py-2 text-gray-700">{item.service}</td>
                      <td className="px-2 py-2">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const link = `${window.location.origin}/a/${item.token}`;
                                await navigator.clipboard.writeText(link);
                                setCopiedId(String(item.id));
                                window.setTimeout(() => {
                                  setCopiedId(null);
                                }, 2000);
                              } catch {
                                setCreateError("No se pudo copiar el enlace");
                              }
                            }}
                            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            {copiedId === String(item.id) ? "✓ Copiado" : "Copiar enlace"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const response = await fetch("/api/appointments/cancel", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ token: item.token }),
                                });
                                if (!response.ok) {
                                  throw new Error("No se pudo cancelar la cita");
                                }

                                const updatedAt = new Date().toISOString();
                                setClinicAppointments((prev) =>
                                  prev.map((row) =>
                                    row.token === item.token
                                      ? { ...row, status: "cancelled", updated_at: updatedAt }
                                      : row,
                                  ),
                                );
                                setAppointment((prev) =>
                                  prev && prev.token === item.token
                                    ? { ...prev, status: "cancelled", updated_at: updatedAt }
                                    : prev,
                                );
                              } catch (error) {
                                setCreateError(
                                  error instanceof Error ? error.message : "No se pudo cancelar la cita",
                                );
                              }
                            }}
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-gray-500" colSpan={5}>
                      No hay citas programadas para hoy
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mb-6 text-sm text-gray-600">Actividad generada desde enlaces enviados a pacientes.</p>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Actividad reciente</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="px-2 py-2 font-medium">Paciente</th>
                  <th className="px-2 py-2 font-medium">Cita</th>
                  <th className="px-2 py-2 font-medium">Acción</th>
                  <th className="px-2 py-2 font-medium">Actualizado</th>
                </tr>
              </thead>
              <tbody>
                {formattedActivity.length > 0 ? (
                  formattedActivity.map((row) => (
                    <tr key={row.uniqueKey} className="border-b border-gray-100">
                      <td className="px-2 py-2 text-gray-900">{row.patientName}</td>
                      <td className="px-2 py-2 text-gray-700">{row.appointmentLabel}</td>
                      <td className="px-2 py-2 text-gray-700">{row.actionLabel}</td>
                      <td className="px-2 py-2 text-gray-600">{row.updatedAtLabel}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-2 py-4 text-gray-500" colSpan={4}>
                      Sin actividad reciente para este token.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Demo rápida</h2>
          <p className="mt-2 text-sm text-gray-600">Abre el flujo del paciente con el token seleccionado.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.open(`/a/${token}`, "_blank", "noopener,noreferrer")}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-95 active:translate-y-[1px]"
              style={{ backgroundColor: theme.primary }}
            >
              Abrir enlace paciente
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(patientLink);
                } catch {
                  setCreateError("No se pudo copiar el enlace");
                }
              }}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition-all duration-150 hover:bg-gray-50 active:translate-y-[1px]"
            >
              Copiar enlace
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  helper,
  type = "text",
  value,
  onChange,
  required = false,
}: {
  label: string;
  placeholder?: string;
  helper?: string;
  type?: "text" | "date" | "time";
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold tracking-wide text-gray-700">{label}</span>
      {helper ? <span className="ml-2 text-[11px] text-gray-500">{helper}</span> : null}
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
      />
    </label>
  );
}

function SelectField({
  label,
  helper,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold tracking-wide text-gray-700">{label}</span>
      {helper ? <span className="ml-2 text-[11px] text-gray-500">{helper}</span> : null}
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{value}</p>
      <div className="mt-3 h-1.5 rounded-full" style={{ backgroundColor: `${accent}33` }} />
    </article>
  );
}
