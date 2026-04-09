"use client";

import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import PatientFooter from "@/components/patient/PatientFooter";
import { toViewAppointment } from "@/lib/appointmentView";
import { getTodayInputValue, toDateInputValue } from "@/lib/dateFormat";
import type { PatientClinicData } from "@/lib/patientClient";
import { fetchPatientAppointmentDetails } from "@/lib/patientClient";
import type { Appointment } from "@/lib/types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AvailabilitySlot = {
  value: string;
  label: string;
};

export default function ReschedulePage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [clinic, setClinic] = useState<PatientClinicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayInputValue());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cargar cita y clínica
  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const details = await fetchPatientAppointmentDetails(token);
        if (!active) return;

        setAppointment(toViewAppointment(details.appointment));
        setClinic(details.clinic);

        const baseDate = details.appointment.scheduled_at
          ? new Date(details.appointment.scheduled_at)
          : new Date();
        const safeBaseDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
        setSelectedDate(toDateInputValue(safeBaseDate));
      } catch {
        if (active) {
          setAppointment(null);
          setClinic(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [token]);

  // Cargar slots cuando cambia la fecha — misma lógica que /b/[clinicSlug]
  useEffect(() => {
    let active = true;

    const loadSlots = async () => {
      const clinicSlug = clinic?.slug;

      if (!selectedDate || !clinicSlug) {
        setSlots([]);
        setSlotsLoading(false);
        return;
      }

      setSlotsLoading(true);
      try {
        const searchParams = new URLSearchParams({
          date: selectedDate,
          clinicSlug,
          excludeToken: token,
        });

        if (appointment?.service) {
          searchParams.set("service", appointment.service);
        }

        const response = await fetch(`/api/availability?${searchParams.toString()}`);
        const data = (await response.json()) as { slots?: AvailabilitySlot[] };
        if (active) {
          setSlots(response.ok ? (data.slots ?? []) : []);
        }
      } catch {
        if (active) setSlots([]);
      } finally {
        if (active) setSlotsLoading(false);
      }
    };

    void loadSlots();
    return () => { active = false; };
  }, [appointment?.service, clinic?.slug, selectedDate, token]);

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

      router.push(`/a/${token}/confirm?changed=1`);
    } catch {
      setErrorMessage("No se pudo reprogramar la cita. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6 text-center text-sm text-muted">
          Cargando cita...
        </section>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="space-y-4">
        <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6 text-center">
          <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">Cita no encontrada</h1>
          <p className="mt-2 text-sm text-muted">Este enlace no corresponde a una cita activa.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HeaderBar
        logoText={clinic?.logoText ?? "RC"}
        clinicName={clinic?.name ?? appointment.clinicName}
      />

      <AppointmentCard appointment={appointment} timezone={clinic?.timezone} />

      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-5">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">Cambiar cita</h1>

        <div className="mt-4 rounded-[14px] border-[0.5px] border-border bg-background p-4">
          <p className="font-heading text-sm font-semibold text-foreground">Tu cita actual</p>
          <p className="mt-2 text-sm text-foreground">{appointment.datetimeLabel}</p>
          <p className="mt-1 text-sm text-muted">{appointment.service}</p>
        </div>

        {/* Selector de fecha — igual que /b/[clinicSlug] */}
        <div className="mt-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Nueva fecha</span>
            <input
              type="date"
              value={selectedDate}
              min={getTodayInputValue()}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
            />
          </label>
        </div>

        {/* Slots de hora */}
        <div className="mt-4">
          <p className="text-sm font-medium text-foreground">Horarios disponibles</p>
          <div className="mt-2">
            {slotsLoading ? (
              <p className="text-sm text-muted">Cargando disponibilidad...</p>
            ) : slots.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.value}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSlotSelect(slot)}
                    className="rounded-[10px] border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground transition-all duration-150 hover:border-primary hover:bg-primary-soft disabled:opacity-60"
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No hay horarios disponibles para este día.</p>
            )}
          </div>
        </div>

        {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
      </section>

      <Link
        href={`/a/${token}`}
        className="inline-flex w-full items-center justify-center rounded-[10px] border-[1.5px] border-primary px-5 py-2.5 font-heading text-sm font-semibold text-primary transition-all duration-150 hover:bg-primary-soft"
      >
        Volver a la cita
      </Link>

      <PatientFooter supportPhone={clinic?.supportPhone ?? null} />
    </div>
  );
}
