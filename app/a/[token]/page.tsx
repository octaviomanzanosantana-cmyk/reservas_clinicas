"use client";

import ActionPanel from "@/components/ActionPanel";
import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import PatientFooter from "@/components/patient/PatientFooter";
import { getAppointmentByToken } from "@/lib/appointments";
import { getClinicTheme } from "@/lib/clinicTheme";
import { getClinicConfig } from "@/lib/demoClinics";
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

function toViewAppointment(row: Awaited<ReturnType<typeof getAppointmentByToken>>): Appointment | null {
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

export default function AppointmentHomePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const clinic = getClinicConfig(token);
  const theme = getClinicTheme(token);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const row = await getAppointmentByToken(token);
        if (active) setAppointment(toViewAppointment(row));
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
            logoText={theme.logoText}
            clinicName={theme.brandName}
            accentColor={theme.accent}
          />

          <section
            className="rounded-[24px] border border-slate-200 bg-white px-5 py-5"
            style={{
              borderColor: `${theme.accent}33`,
              backgroundColor: `${theme.accent}12`,
            }}
          >
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              {appointment.status === "confirmed" ? "✔ " : ""}
              {STATUS_TITLE[appointment.status]}
            </h1>
            <p className="mt-2 text-sm text-slate-600">{STATUS_MESSAGE[appointment.status]}</p>
          </section>

          <AppointmentCard appointment={appointment} />

          {appointment.status !== "cancelled" && appointment.status !== "completed" ? (
            <section className="rounded-[20px] border border-slate-200 bg-slate-50/60 p-5">
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
                    setCancelError("No se pudo cancelar la cita. Inténtalo de nuevo.");
                  } finally {
                    setCancelLoading(false);
                  }
                }}
                disabled={cancelLoading}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cancelLoading ? "Cancelando..." : "Cancelar cita"}
              </button>

              {cancelMessage ? (
                <p className="mt-3 text-sm text-emerald-700">{cancelMessage}</p>
              ) : null}
              {cancelError ? <p className="mt-3 text-sm text-red-600">{cancelError}</p> : null}
            </section>
          ) : null}

          {appointment.status === "pending" ||
          appointment.status === "confirmed" ||
          appointment.status === "change_requested" ? (
            <div className="[&_button]:rounded-2xl [&_button]:px-5 [&_button]:py-3 [&_button]:text-sm [&_button]:font-semibold [&_.primary]:bg-slate-950 [&_.primary]:text-white [&_.secondary]:border [&_.secondary]:border-slate-200 [&_.secondary]:bg-white [&_.secondary]:text-slate-900">
              <ActionPanel
                primaryColor={theme.primary}
                accentColor={theme.accent}
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

          <PatientFooter supportPhone={clinic.supportPhone ?? null} />
        </div>
      </section>
    );
  }, [appointment, clinic.supportPhone, loading, router, theme.accent, theme.brandName, theme.logoText, theme.primary, token]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-12">{content}</div>
    </div>
  );
}
