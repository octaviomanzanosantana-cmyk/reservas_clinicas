"use client";

import ActionPanel from "@/components/ActionPanel";
import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import PatientFooter from "@/components/patient/PatientFooter";
import type { PatientClinicData } from "@/lib/patientClient";
import { fetchPatientAppointmentDetails } from "@/lib/patientClient";
import type { Appointment } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const STATUS_MESSAGE: Record<Appointment["status"], string> = {
  pending: "Tu cita esta pendiente de confirmacion",
  confirmed: "Tu cita esta confirmada",
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

type PatientAppointmentRow = {
  id: number;
  token: string;
  clinic_name: string;
  service: string;
  scheduled_at: string | null;
  datetime_label: string;
  patient_name: string;
  address: string;
  duration_label: string;
  status: Appointment["status"];
  updated_at: string;
};

function toViewAppointment(row: PatientAppointmentRow): Appointment {
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

function getBranding(clinic: PatientClinicData | null, appointment: Appointment | null) {
  return {
    clinicName: clinic?.name ?? appointment?.clinicName ?? "Clinica",
    logoText: clinic?.logoText ?? "RC",
    primary: clinic?.primaryColor ?? "#2563eb",
    accent: clinic?.accentColor ?? "#1d4ed8",
  };
}

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

        setAppointment(toViewAppointment(details.appointment as PatientAppointmentRow));
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

  const branding = getBranding(clinic, appointment);

  const content = useMemo(() => {
    if (loading) {
      return (
        <section className="rounded-[24px] border border-slate-200 bg-white p-7 text-center text-sm text-slate-600 md:p-8">
          Cargando cita...
        </section>
      );
    }

    if (!appointment) {
      return (
        <section className="rounded-[24px] border border-slate-200 bg-white p-7 text-center md:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Cita no encontrada
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            Este enlace no corresponde a una cita activa.
          </p>
        </section>
      );
    }

    return (
      <section className="rounded-[24px] border border-slate-200 bg-white p-7 md:p-8">
        <div className="space-y-6">
          <HeaderBar
            logoText={branding.logoText}
            clinicName={branding.clinicName}
            accentColor={branding.accent}
          />

          <section
            className="rounded-[24px] border border-slate-200 bg-white px-5 py-5"
            style={{
              borderColor: `${branding.accent}33`,
              backgroundColor: `${branding.accent}12`,
            }}
          >
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {appointment.status === "confirmed" ? "Confirmada: " : ""}
              {STATUS_TITLE[appointment.status]}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{STATUS_MESSAGE[appointment.status]}</p>
          </section>

          <AppointmentCard appointment={appointment} />

          {appointment.status === "pending" ||
          appointment.status === "confirmed" ||
          appointment.status === "change_requested" ? (
            <div className="[&_button]:rounded-2xl [&_button]:px-5 [&_button]:py-3 [&_button]:text-sm [&_button]:font-semibold [&_.primary]:bg-slate-950 [&_.primary]:text-white [&_.secondary]:border [&_.secondary]:border-slate-200 [&_.secondary]:bg-white [&_.secondary]:text-slate-900">
              <ActionPanel
                primaryColor={branding.primary}
                accentColor={branding.accent}
                showConfirm={appointment.status === "pending"}
                onConfirm={async () => {
                  router.push(`/a/${token}/confirm`);
                }}
                onReschedule={() => {
                  router.push(`/a/${token}/reschedule`);
                }}
              />
            </div>
          ) : null}

          {appointment.status !== "cancelled" && appointment.status !== "completed" ? (
            <section className="mt-4 text-center">
              <button
                type="button"
                onClick={async () => {
                  setCancelLoading(true);
                  setCancelMessage(null);
                  setCancelError(null);

                  try {
                    const response = await fetch("/api/appointments/cancel", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ token }),
                    });

                    if (!response.ok) {
                      throw new Error("cancel_failed");
                    }

                    setAppointment((current) =>
                      current
                        ? {
                            ...current,
                            status: "cancelled",
                          }
                        : current,
                    );
                    setCancelMessage("Tu cita ha sido cancelada.");
                  } catch {
                    setCancelError("No se pudo cancelar la cita. Intentalo de nuevo.");
                  } finally {
                    setCancelLoading(false);
                  }
                }}
                disabled={cancelLoading}
                className="text-sm text-red-500 transition-colors duration-150 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelLoading ? "Cancelando..." : "Cancelar cita"}
              </button>

              {cancelMessage ? (
                <p className="mt-3 text-sm text-emerald-700">{cancelMessage}</p>
              ) : null}
              {cancelError ? <p className="mt-3 text-sm text-red-600">{cancelError}</p> : null}
            </section>
          ) : null}

          <PatientFooter supportPhone={clinic?.supportPhone ?? null} />
        </div>
      </section>
    );
  }, [
    appointment,
    branding.accent,
    branding.clinicName,
    branding.logoText,
    branding.primary,
    cancelError,
    cancelLoading,
    cancelMessage,
    clinic?.supportPhone,
    loading,
    router,
    token,
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-12">{content}</div>
    </div>
  );
}
