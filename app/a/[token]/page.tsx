"use client";

import ActionPanel from "@/components/ActionPanel";
import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import { getAppointmentByToken } from "@/lib/appointments";
import { getClinicTheme } from "@/lib/clinicTheme";
import { getClinicConfig } from "@/lib/demoClinics";
import type { Appointment } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function toViewAppointment(row: Awaited<ReturnType<typeof getAppointmentByToken>>): Appointment | null {
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

export default function AppointmentHomePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const clinic = getClinicConfig(token);
  const theme = getClinicTheme(token);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);

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
        <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600 shadow-sm">
          Cargando cita...
        </section>
      );
    }

    if (!appointment) {
      return (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
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

        <span
          className="inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ backgroundColor: `${theme.accent}1f`, color: theme.accent }}
        >
          Enlace seguro de autoservicio
        </span>

        <p className="text-xs text-gray-500">Tu cita es en 2 días</p>

        {appointment.status === "confirmed" ? (
          <p className="text-sm font-medium text-emerald-600">Cita confirmada</p>
        ) : null}
        {appointment.status === "change_requested" ? (
          <p className="text-sm font-medium text-blue-700">Solicitud de cambio enviada</p>
        ) : null}

        <AppointmentCard appointment={appointment} />

        <ActionPanel
          primaryColor={theme.primary}
          accentColor={theme.accent}
          onConfirm={async () => {
            router.push(`/a/${token}/confirm`);
          }}
          onReschedule={() => {
            router.push(`/a/${token}/reschedule`);
          }}
          onCancel={async () => {
            router.push(`/a/${token}/cancel`);
          }}
        />

        <footer className="pb-4 text-center text-xs text-gray-600">
          <p className="font-medium text-gray-700">No compartas este enlace</p>
          <p className="mt-1">Soporte: {clinic.supportPhone}</p>
        </footer>
      </>
    );
  }, [appointment, clinic.supportPhone, loading, router, theme.accent, theme.brandName, theme.logoText, theme.primary, token]);

  return <div className="space-y-6">{content}</div>;
}
