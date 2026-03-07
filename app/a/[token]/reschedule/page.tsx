"use client";

import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import { getAppointmentByToken, updateAppointment } from "@/lib/appointments";
import { getClinicTheme } from "@/lib/clinicTheme";
import type { Appointment } from "@/lib/types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const SLOTS = [
  "Lunes · 16:30",
  "Lunes · 17:00",
  "Martes · 10:00",
  "Martes · 11:30",
  "Miércoles · 12:00",
  "Miércoles · 16:00",
];

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

export default function ReschedulePage() {
  const params = useParams();
  const token = params.token as string;
  const theme = getClinicTheme(token);
  const router = useRouter();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  const handleSlotSelect = async (slot: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await updateAppointment(token, {
        status: "change_requested",
        datetime_label: slot,
      });
      router.push(`/a/${token}/confirm`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600 shadow-sm">
          Cargando cita...
        </section>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Cita no encontrada</h1>
          <p className="mt-2 text-sm text-gray-600">Este enlace no corresponde a una cita activa.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HeaderBar
        logoText={theme.logoText}
        clinicName={theme.brandName}
        idLabel={appointment.idLabel}
        accentColor={theme.accent}
      />

      <AppointmentCard appointment={appointment} />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Selecciona un nuevo horario</h1>
        <p className="mt-2 text-sm text-gray-600">
          Al solicitar el cambio, la clínica revisará tu solicitud y te confirmará el horario.
        </p>

        <div className="mt-4 space-y-2">
          {SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => handleSlotSelect(slot)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 shadow-sm transition-all duration-150 hover:bg-gray-50 active:translate-y-[1px]"
            >
              {slot}
            </button>
          ))}
        </div>
      </section>

      <Link
        href={`/a/${token}`}
        className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all duration-150 hover:bg-gray-50 active:translate-y-[1px]"
      >
        Volver a la cita
      </Link>
    </div>
  );
}
