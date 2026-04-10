"use client";

import ActionPanel from "@/components/ActionPanel";
import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import PatientFooter from "@/components/patient/PatientFooter";
import type { PatientClinicData } from "@/lib/patientClient";
import { fetchPatientAppointmentDetails } from "@/lib/patientClient";
import { toViewAppointment } from "@/lib/appointmentView";
import {
  buildGoogleCalendarUrl,
  downloadIcsFile,
  parseDurationFromLabel,
} from "@/lib/calendarExport";
import type { Appointment } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const STATUS_MESSAGE: Record<Appointment["status"], string> = {
  pending: "Tu cita está pendiente de confirmación",
  confirmed: "Tu cita está confirmada",
  cancelled: "Esta cita ha sido cancelada",
  change_requested: "Hemos recibido tu solicitud de cambio",
  completed: "Esta cita ya ha sido completada",
};

const STATUS_TITLE: Record<Appointment["status"], string> = {
  pending: "Cita pendiente",
  confirmed: "Cita confirmada",
  cancelled: "Cita cancelada",
  change_requested: "Cambio solicitado",
  completed: "Cita completada",
};

export default function AppointmentHomePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [clinic, setClinic] = useState<PatientClinicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const details = await fetchPatientAppointmentDetails(token);
        if (!active) return;

        setAppointment(toViewAppointment(details.appointment));
        setClinic(details.clinic);
      } catch {
        if (!active) return;
        setAppointment(null);
        setClinic(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [token]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <section className="rounded-[14px] border-[0.5px] border-border bg-card p-7 text-center text-sm text-muted md:p-8">
          Cargando cita...
        </section>
      );
    }

    if (!appointment) {
      return (
        <section className="rounded-[14px] border-[0.5px] border-border bg-card p-7 text-center md:p-8">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            Cita no encontrada
          </h1>
          <p className="mt-3 text-sm text-muted">
            Este enlace no corresponde a una cita activa.
          </p>
        </section>
      );
    }

    return (
      <div className="space-y-4">
        <HeaderBar
          logoText={clinic?.logoText ?? "RC"}
          clinicName={clinic?.name ?? appointment.clinicName}
        />

        <section className="rounded-[14px] border-[0.5px] border-primary/20 bg-primary-soft px-5 py-5">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            {STATUS_TITLE[appointment.status]}
          </h1>
          <p className="mt-2 text-sm text-muted">{STATUS_MESSAGE[appointment.status]}</p>
        </section>

        <AppointmentCard appointment={appointment} timezone={clinic?.timezone} />

        {appointment.status === "cancelled" && clinic?.slug ? (
          <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6 text-center">
            <p className="text-sm text-muted">Esta cita ha sido cancelada</p>
            <a
              href={`/b/${clinic.slug}`}
              className="mt-4 inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-all duration-150 hover:bg-primary-hover"
            >
              Reservar nueva cita →
            </a>
          </section>
        ) : null}

        {appointment.modality === "online" && appointment.status !== "cancelled" && appointment.status !== "completed" ? (
          appointment.videoLink ? (
            <div className="rounded-[14px] border-[0.5px] border-primary/20 bg-primary-soft p-5 text-center">
              <p className="font-heading text-sm font-semibold text-foreground">Tu consulta es online</p>
              <a
                href={appointment.videoLink}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-all duration-150 hover:bg-primary-hover"
              >
                Unirse a la consulta →
              </a>
            </div>
          ) : (
            <div className="rounded-[14px] border-[0.5px] border-border bg-card p-5 text-center">
              <p className="text-sm text-muted">
                Tu consulta es online. Recibirás el enlace de acceso próximamente por email.
              </p>
            </div>
          )
        ) : null}

        {appointment.scheduledAt && appointment.status !== "cancelled" && appointment.status !== "completed" ? (() => {
          const calendarInput = {
            title: `${appointment.service} — ${clinic?.name ?? appointment.clinicName}`,
            description: `Paciente: ${appointment.patientName}\nModalidad: ${appointment.modality === "online" ? "Online" : "Presencial"}\nClínica: ${clinic?.name ?? appointment.clinicName}`,
            location: appointment.modality === "online" ? "" : appointment.address,
            startDate: new Date(appointment.scheduledAt!),
            durationMinutes: parseDurationFromLabel(appointment.durationLabel),
          };
          const googleUrl = buildGoogleCalendarUrl(calendarInput);
          return (
            <div className="rounded-[14px] border-[0.5px] border-border bg-card p-5">
              <p className="font-heading text-sm font-semibold text-foreground">Añadir al calendario</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <a
                  href={googleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-[10px] border-[0.5px] border-border px-4 py-2.5 text-sm font-medium text-muted transition-all duration-150 hover:text-foreground"
                >
                  Google Calendar
                </a>
                <button
                  type="button"
                  onClick={() => downloadIcsFile(calendarInput, "cita.ics")}
                  className="inline-flex items-center gap-2 rounded-[10px] border-[0.5px] border-border px-4 py-2.5 text-sm font-medium text-muted transition-all duration-150 hover:text-foreground"
                >
                  Apple Calendar
                </button>
              </div>
            </div>
          );
        })() : null}

        {appointment.status === "pending" ||
        appointment.status === "confirmed" ||
        appointment.status === "change_requested" ? (
          <ActionPanel
            showConfirm={appointment.status === "pending"}
            onConfirm={() => {
              router.push(`/a/${token}/confirm`);
            }}
            onReschedule={() => {
              router.push(`/a/${token}/reschedule`);
            }}
          />
        ) : null}

        {appointment.status !== "cancelled" && appointment.status !== "completed" ? (() => {
          const cancelHoursLimit = clinic?.cancelHoursLimit ?? 24;
          const scheduledAt = appointment.scheduledAt ? new Date(appointment.scheduledAt) : null;
          const hoursUntilAppointment = scheduledAt
            ? (scheduledAt.getTime() - Date.now()) / 3_600_000
            : null;
          const canCancel = hoursUntilAppointment === null || hoursUntilAppointment >= cancelHoursLimit;

          return (
            <section className="mt-4 text-center">
              {canCancel ? (
                <button
                  type="button"
                  onClick={async () => {
                    setCancelLoading(true);
                    setCancelMessage(null);
                    setCancelError(null);

                    try {
                      const response = await fetch("/api/appointments/cancel", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ token }),
                      });

                      if (!response.ok) {
                        throw new Error("cancel_failed");
                      }

                      setAppointment((current) =>
                        current ? { ...current, status: "cancelled" } : current,
                      );
                      setCancelMessage("Tu cita ha sido cancelada.");
                    } catch {
                      setCancelError("No se pudo cancelar la cita. Inténtalo de nuevo.");
                    } finally {
                      setCancelLoading(false);
                    }
                  }}
                  disabled={cancelLoading}
                  className="w-full rounded-[10px] border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-all duration-150 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelLoading ? "Cancelando..." : "Cancelar cita"}
                </button>
              ) : (
                <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p className="font-medium">Esta cita es en menos de {cancelHoursLimit} horas</p>
                  <p className="mt-1 text-amber-700">
                    Para cancelar, contacta directamente con la clínica{clinic?.supportPhone ? `: ${clinic.supportPhone}` : "."}
                  </p>
                </div>
              )}

              {cancelMessage ? (
                <p className="mt-3 text-sm text-primary">{cancelMessage}</p>
              ) : null}
              {cancelError ? <p className="mt-3 text-sm text-red-600">{cancelError}</p> : null}
            </section>
          );
        })() : null}

        <PatientFooter supportPhone={clinic?.supportPhone ?? null} />
      </div>
    );
  }, [appointment, cancelError, cancelLoading, cancelMessage, clinic, loading, router, token]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-12">{content}</div>
    </div>
  );
}
