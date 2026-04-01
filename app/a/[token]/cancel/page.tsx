"use client";

import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import PatientFooter from "@/components/patient/PatientFooter";
import Toast from "@/components/Toast";
import { toViewAppointmentOrNull, type AppointmentRowLike } from "@/lib/appointmentView";
import type { PatientClinicData } from "@/lib/patientClient";
import type { Appointment } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function CancelPage() {
  const params = useParams();
  const token = params.token as string;
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [clinic, setClinic] = useState<PatientClinicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastVisible, setToastVisible] = useState(true);
  const [calendarWarning, setCalendarWarning] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/appointments/cancel", {
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

    return (
      <>
        <HeaderBar
          logoText={clinic?.logoText ?? "RC"}
          clinicName={clinic?.name ?? appointment.clinicName}
        />

        <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--badge-cancelled-bg)] text-[var(--badge-cancelled-text)]">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v5" strokeLinecap="round" />
              <path d="M12 16h.01" strokeLinecap="round" />
              <path d="M10.3 3.2L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.2a2 2 0 00-3.4 0z" />
            </svg>
          </div>
          <h1 className="text-center font-heading text-xl font-semibold tracking-tight text-foreground">Cita cancelada</h1>
          <p className="mt-2 text-center text-sm text-muted">La clinica ha recibido la cancelacion.</p>
        </section>

        <AppointmentCard appointment={appointment} />

        <Link
          href={`/a/${token}`}
          className="inline-flex w-full items-center justify-center rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover"
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
            Cita cancelada. No se pudo actualizar Google Calendar: {calendarWarning}
          </p>
        ) : null}
        <PatientFooter supportPhone={clinic?.supportPhone ?? null} />
      </>
    );
  }, [appointment, calendarWarning, clinic, loading, toastVisible, token]);

  return <div className="space-y-4">{content}</div>;
}
