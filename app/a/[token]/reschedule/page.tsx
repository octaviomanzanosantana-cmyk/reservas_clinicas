"use client";

import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import { getAppointmentByToken } from "@/lib/appointments";
import { getClinicTheme } from "@/lib/clinicTheme";
import type { Appointment } from "@/lib/types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AvailabilitySlot = {
  value: string;
  label: string;
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const row = await getAppointmentByToken(token);
        if (!active) return;

        setAppointment(toViewAppointment(row));

        const baseDate = row?.scheduled_at ? new Date(row.scheduled_at) : new Date();
        const safeBaseDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
        setSelectedDate(toDateInputValue(safeBaseDate));
      } catch {
        if (active) {
          setAppointment(null);
          setSelectedDate("");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    let active = true;

    const loadSlots = async () => {
      if (!selectedDate) {
        setSlots([]);
        setSlotsLoading(false);
        return;
      }

      setSlotsLoading(true);
      try {
        const response = await fetch(
          `/api/availability?date=${encodeURIComponent(selectedDate)}&excludeToken=${encodeURIComponent(token)}`,
        );
        const data = (await response.json()) as { slots?: AvailabilitySlot[] };
        if (active) {
          setSlots(response.ok ? (data.slots ?? []) : []);
        }
      } catch {
        if (active) {
          setSlots([]);
        }
      } finally {
        if (active) {
          setSlotsLoading(false);
        }
      }
    };

    void loadSlots();

    return () => {
      active = false;
    };
  }, [selectedDate, token]);

  const handleSlotSelect = async (slot: AvailabilitySlot) => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/appointments/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          scheduled_at: slot.value,
          datetime_label: slot.label,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo reprogramar la cita");
      }

      router.push(`/a/${token}/confirm`);
    } catch {
      setErrorMessage("No se pudo reprogramar la cita. Inténtalo de nuevo.");
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
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">Tu cita actual</p>
          <p className="mt-2 text-sm text-gray-700">{appointment.datetimeLabel}</p>
          <p className="mt-1 text-sm text-gray-600">{appointment.service}</p>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Selecciona un nuevo horario
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Elige un nuevo horario disponible para reprogramar tu cita.
        </p>

        <div className="mt-4 space-y-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <label className="block text-sm font-semibold text-gray-900" htmlFor="selected-date">
              Elige un día
            </label>
            <input
              id="selected-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>

          {slotsLoading ? (
            <p className="text-sm text-gray-600">Cargando disponibilidad...</p>
          ) : slots.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.value}
                  type="button"
                  onClick={() => handleSlotSelect(slot)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-sm transition-all duration-150 hover:bg-gray-50 active:translate-y-[1px]"
                >
                  {slot.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No hay horarios disponibles para esa fecha.</p>
          )}
        </div>
        {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
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
