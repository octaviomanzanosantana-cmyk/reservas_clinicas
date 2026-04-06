"use client";

import ActionPanel from "@/components/ActionPanel";
import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import PatientFooter from "@/components/patient/PatientFooter";
import type { PatientClinicData } from "@/lib/patientClient";
import { fetchPatientAppointmentDetails } from "@/lib/patientClient";
import { toViewAppointment } from "@/lib/appointmentView";
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

        <AppointmentCard appointment={appointment} />

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

            {cancelMessage ? (
              <p className="mt-3 text-sm text-primary">{cancelMessage}</p>
            ) : null}
            {cancelError ? <p className="mt-3 text-sm text-red-600">{cancelError}</p> : null}
          </section>
        ) : null}

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
