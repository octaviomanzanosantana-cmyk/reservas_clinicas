"use client";

import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import PatientFooter from "@/components/patient/PatientFooter";
import Toast from "@/components/Toast";
import type { AppointmentRow } from "@/lib/appointments";
import { getClinicTheme } from "@/lib/clinicTheme";
import { getClinicConfig } from "@/lib/demoClinics";
import type { Appointment } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function toViewAppointment(row: AppointmentRow | null): Appointment | null {
  if (!row) return null;

  return {
    token: row.token,
    clinicName: row.clinic_name,
    service: row.service,
    datetimeLabel: row.datetime_label,
    scheduledAt: row.scheduled_at,
    patientName: row.patient_name,
    address: row.address,
    durationLabel: row.duration_label,
    status: row.status,
    lastUpdateLabel: row.updated_at,
    idLabel: `${row.clinic_name.slice(0, 2).toUpperCase()}-${row.id}`,
  };
}

function buildGoogleCalendarUrl(appointment: Appointment): string | null {
  if (!appointment.scheduledAt) return null;

  const start = new Date(appointment.scheduledAt);
  if (Number.isNaN(start.getTime())) return null;

  const durationMatch = appointment.durationLabel.match(/\d+/);
  const durationMinutes = durationMatch ? Number(durationMatch[0]) : 30;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const formatGoogleDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: appointment.service,
    dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
    details: `Cita: ${appointment.service}\nClinica: ${appointment.clinicName}`,
    location: appointment.address,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getDateAndTimeLabels(appointment: Appointment): { dateLabel: string; timeLabel: string } {
  if (appointment.scheduledAt) {
    const scheduledAt = new Date(appointment.scheduledAt);

    if (!Number.isNaN(scheduledAt.getTime())) {
      return {
        dateLabel: new Intl.DateTimeFormat("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(scheduledAt),
        timeLabel: new Intl.DateTimeFormat("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(scheduledAt),
      };
    }
  }

  const [dateLabel, timeLabel = ""] = appointment.datetimeLabel.split("·").map((value) => value.trim());
  return { dateLabel, timeLabel };
}

export default function ConfirmPage() {
  const params = useParams();
  const token = params.token as string;
  const clinic = getClinicConfig(token);
  const theme = getClinicTheme(token);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastVisible, setToastVisible] = useState(true);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/appointments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          if (active) setAppointment(null);
          return;
        }

        const data = (await response.json()) as {
          appointment?: AppointmentRow;
          calendarWarning?: string | null;
        };

        if (active) {
          setAppointment(toViewAppointment(data.appointment ?? null));
          setCalendarWarning(data.calendarWarning ?? null);
        }
      } catch {
        if (active) setAppointment(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentSearchParams = new URLSearchParams(window.location.search);
    setChanged(currentSearchParams.get("changed") === "1");
  }, []);

  const content = useMemo(() => {
    if (loading) {
      return (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          Cargando cita...
        </section>
      );
    }

    if (!appointment) {
      return (
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Cita no encontrada</h1>
          <p className="mt-2 text-sm text-gray-600">Este enlace no corresponde a una cita activa.</p>
        </section>
      );
    }

    const isChangeRequested = appointment.status === "change_requested";
    const title = isChangeRequested ? "Solicitud de cambio enviada" : "Tu cita está confirmada";
    const description = isChangeRequested
      ? `Tu cita ha sido reprogramada para ${appointment.datetimeLabel}.`
      : appointment.datetimeLabel;
    const googleCalendarUrl = buildGoogleCalendarUrl(appointment);
    const { dateLabel, timeLabel } = getDateAndTimeLabels(appointment);
    const whatsappUrl =
      changed && appointment.status === "confirmed" && dateLabel && timeLabel
        ? `https://wa.me/?text=${encodeURIComponent(
            [
              "Hola, esta es mi nueva cita:",
              "",
              appointment.clinicName,
              appointment.service,
              `${dateLabel} · ${timeLabel}`,
              "",
              `Gestionar cita: ${
                typeof window !== "undefined"
                  ? `${window.location.origin}/a/${token}`
                  : `/a/${token}`
              }`,
            ].join("\n"),
          )}`
        : null;

    return (
      <>
        <HeaderBar
          logoText={theme.logoText}
          clinicName={theme.brandName}
          idLabel={appointment.idLabel}
          accentColor={theme.accent}
        />

        <section className="rounded-[24px] border border-slate-200 bg-white px-6 py-5">
          <div
            className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full ${
              isChangeRequested ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2.1">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-center text-lg font-semibold tracking-tight text-gray-900">{title}</h1>
          <p className="mt-1.5 text-center text-sm text-gray-600">{description}</p>
        </section>

        <AppointmentCard appointment={appointment} />

        {googleCalendarUrl ? (
          <a
            href={googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold text-white transition-all duration-150 hover:brightness-95 active:translate-y-[1px]"
            style={{ backgroundColor: theme.primary }}
          >
            Añadir a mi calendario
          </a>
        ) : null}

        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 transition-all duration-150 hover:bg-emerald-100"
          >
            Enviar a WhatsApp
          </a>
        ) : null}

        <Link
          href={`/a/${token}`}
          className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 active:translate-y-[1px]"
        >
          Volver a la cita
        </Link>

        <Toast
          message="Acción realizada. La clínica ha sido notificada."
          visible={toastVisible}
          onHide={() => setToastVisible(false)}
        />
        {calendarWarning ? (
          <p className="text-center text-xs text-amber-700">
            Cita confirmada. No se pudo actualizar Google Calendar: {calendarWarning}
          </p>
        ) : null}
        <PatientFooter supportPhone={clinic.supportPhone ?? null} />
      </>
    );
  }, [
    appointment,
    calendarWarning,
    clinic.supportPhone,
    loading,
    theme.accent,
    theme.brandName,
    theme.logoText,
    theme.primary,
    toastVisible,
    token,
    changed,
  ]);

  return <div className="space-y-4">{content}</div>;
}
