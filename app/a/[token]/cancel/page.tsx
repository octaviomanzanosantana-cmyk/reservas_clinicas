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
    patientName: row.patient_name,
    address: row.address,
    durationLabel: row.duration_label,
    status: row.status,
    lastUpdateLabel: row.updated_at,
    idLabel: `${row.clinic_name.slice(0, 2).toUpperCase()}-${row.id}`,
  };
}

export default function CancelPage() {
  const params = useParams();
  const token = params.token as string;
  const theme = getClinicTheme(token);
  const clinic = getClinicConfig(token);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
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

    return (
      <>
        <HeaderBar
          logoText={theme.logoText}
          clinicName={theme.brandName}
          idLabel={appointment.idLabel}
          accentColor={theme.accent}
        />

        <section className="rounded-[24px] border border-slate-200 bg-white p-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v5" strokeLinecap="round" />
              <path d="M12 16h.01" strokeLinecap="round" />
              <path d="M10.3 3.2L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.2a2 2 0 00-3.4 0z" />
            </svg>
          </div>
          <h1 className="text-center text-xl font-semibold tracking-tight text-gray-900">Cita cancelada</h1>
          <p className="mt-2 text-center text-sm text-gray-600">La clínica ha recibido la cancelación.</p>
        </section>

        <AppointmentCard appointment={appointment} />

        <Link
          href={`/a/${token}`}
          className="inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all duration-150 hover:brightness-95 active:translate-y-[1px]"
          style={{ backgroundColor: theme.primary }}
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
            Cita cancelada. No se pudo actualizar Google Calendar: {calendarWarning}
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
  ]);

  return <div className="space-y-4">{content}</div>;
}
