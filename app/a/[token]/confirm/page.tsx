"use client";

import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import PatientFooter from "@/components/patient/PatientFooter";
import Toast from "@/components/Toast";
import { toViewAppointmentOrNull, type AppointmentRowLike } from "@/lib/appointmentView";
import {
  buildGoogleCalendarUrl,
  downloadIcsFile,
  parseDurationFromLabel,
} from "@/lib/calendarExport";
import type { PatientClinicData } from "@/lib/patientClient";
import type { Appointment } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function ConfirmPage() {
  const params = useParams();
  const token = params.token as string;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [clinic, setClinic] = useState<PatientClinicData | null>(null);
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
          if (active) { setAppointment(null); setClinic(null); }
          return;
        }

        const data = (await response.json()) as {
          appointment?: AppointmentRowLike;
          clinic?: PatientClinicData;
          calendarWarning?: string | null;
        };

        if (active) {
          setAppointment(toViewAppointmentOrNull(data.appointment ?? null));
          setClinic(data.clinic ?? null);
          setCalendarWarning(data.calendarWarning ?? null);
        }
      } catch {
        if (active) { setAppointment(null); setClinic(null); }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setChanged(new URLSearchParams(window.location.search).get("changed") === "1");
  }, []);

  const content = useMemo(() => {
    if (loading) {
      return (
        <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6 text-center text-sm text-muted">
          Cargando cita...
        </section>
      );
    }

    if (!appointment) {
      return (
        <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6 text-center">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">Cita no encontrada</h1>
          <p className="mt-2 text-sm text-muted">Este enlace no corresponde a una cita activa.</p>
        </section>
      );
    }

    const clinicName = clinic?.name ?? appointment.clinicName;
    const title = appointment.status === "change_requested"
      ? "Solicitud de cambio enviada"
      : "Tu cita esta confirmada";
    const description = appointment.status === "change_requested"
      ? `Tu cita ha sido reprogramada para ${appointment.datetimeLabel}.`
      : appointment.datetimeLabel;

    const calendarInput = appointment.scheduledAt
      ? {
          title: `${appointment.service} — ${clinicName}`,
          description: `Cita: ${appointment.service}\nClinica: ${clinicName}`,
          location: appointment.address,
          startDate: new Date(appointment.scheduledAt),
          durationMinutes: parseDurationFromLabel(appointment.durationLabel),
        }
      : null;

    const googleUrl = calendarInput ? buildGoogleCalendarUrl(calendarInput) : null;

    const whatsappUrl = changed && appointment.status === "confirmed"
      ? `https://wa.me/?text=${encodeURIComponent(
          [
            `Hola, esta es mi nueva cita:`,
            `${clinicName} — ${appointment.service}`,
            appointment.datetimeLabel,
            `Gestionar: ${typeof window !== "undefined" ? `${window.location.origin}/a/${token}` : `/a/${token}`}`,
          ].join("\n"),
        )}`
      : null;

    return (
      <>
        <HeaderBar
          logoText={clinic?.logoText ?? "RC"}
          clinicName={clinicName}
        />

        <section className="rounded-[14px] border-[0.5px] border-primary/20 bg-primary-soft px-6 py-5">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2.1">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-center font-heading text-lg font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1.5 text-center text-sm text-muted">{description}</p>
        </section>

        <AppointmentCard appointment={appointment} />

        {calendarInput ? (
          <div className="rounded-[14px] border-[0.5px] border-border bg-card p-5">
            <p className="font-heading text-sm font-semibold text-foreground">Añadir al calendario</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {googleUrl ? (
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-[10px] border-[0.5px] border-border px-4 py-2.5 text-sm font-medium text-muted transition-all duration-150 hover:text-foreground"
                >
                  Google Calendar
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => downloadIcsFile(calendarInput, "cita.ics")}
                className="inline-flex items-center gap-2 rounded-[10px] border-[0.5px] border-border px-4 py-2.5 text-sm font-medium text-muted transition-all duration-150 hover:text-foreground"
              >
                Descargar .ics
              </button>
            </div>
          </div>
        ) : null}

        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center rounded-[10px] bg-[#25D366] px-5 py-2.5 font-heading text-sm font-semibold text-white transition-all duration-150 hover:brightness-95"
          >
            Enviar a WhatsApp
          </a>
        ) : null}

        <Link
          href={`/a/${token}`}
          className="inline-flex w-full items-center justify-center rounded-[10px] border-[1.5px] border-primary px-5 py-2.5 font-heading text-sm font-semibold text-primary transition-all duration-150 hover:bg-primary-soft"
        >
          Volver a la cita
        </Link>

        <Toast
          message="Accion realizada. La clinica ha sido notificada."
          visible={toastVisible}
          onHide={() => setToastVisible(false)}
        />
        {calendarWarning ? (
          <p className="text-center text-xs text-muted">
            Cita confirmada. No se pudo actualizar Google Calendar: {calendarWarning}
          </p>
        ) : null}
        <PatientFooter supportPhone={clinic?.supportPhone ?? null} />
      </>
    );
  }, [appointment, calendarWarning, changed, clinic, loading, toastVisible, token]);

  return <div className="space-y-4">{content}</div>;
}
