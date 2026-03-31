"use client";

import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import PatientFooter from "@/components/patient/PatientFooter";
import { toViewAppointment } from "@/lib/appointmentView";
import { toDateInputValue } from "@/lib/dateFormat";
import type { PatientClinicData } from "@/lib/patientClient";
import { fetchPatientAppointmentDetails } from "@/lib/patientClient";
import type { Appointment } from "@/lib/types";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type AvailabilitySlot = {
  value: string;
  label: string;
};

type AvailabilityDateOption = {
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
  const [availableDates, setAvailableDates] = useState<AvailabilityDateOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [datesLoading, setDatesLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fecha base para buscar disponibilidad — se fija una vez al cargar la cita
  // y no cambia al seleccionar fechas, evitando re-fetchs innecesarios.
  const baseDateRef = useRef<string>("");

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
        const dateValue = toDateInputValue(safeBaseDate);
        baseDateRef.current = dateValue;
        setSelectedDate(dateValue);
      } catch {
        if (active) {
          setAppointment(null);
          setClinic(null);
          setSelectedDate("");
        }
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

  // Cargar fechas disponibles UNA SOLA VEZ cuando la cita y clínica están listas.
  // Usa baseDateRef (la fecha de la cita original) como punto de partida,
  // NO selectedDate — así el usuario puede navegar por fechas sin re-fetch.
  useEffect(() => {
    let active = true;

    const loadDates = async () => {
      const clinicSlug = clinic?.slug;
      const service = appointment?.service;
      const baseDate = baseDateRef.current;

      if (!clinicSlug || !service || !baseDate) {
        setAvailableDates([]);
        setDatesLoading(false);
        return;
      }

      setDatesLoading(true);
      try {
        const searchParams = new URLSearchParams({
          date: baseDate,
          clinicSlug,
          service,
          excludeToken: token,
          mode: "dates",
          limit: "14",
        });

        const response = await fetch(`/api/availability?${searchParams.toString()}`);
        const data = (await response.json()) as {
          dates?: AvailabilityDateOption[];
          error?: string;
        };

        if (!active) return;

        if (!response.ok) {
          throw new Error(data.error ?? "No se pudieron cargar las fechas disponibles");
        }

        const nextDates = data.dates ?? [];
        setAvailableDates(nextDates);

        // Auto-seleccionar la primera fecha disponible si la actual no está en la lista
        setSelectedDate((current) => {
          if (nextDates.some((item) => item.value === current)) {
            return current;
          }
          return nextDates[0]?.value ?? current;
        });
      } catch {
        if (!active) return;
        setAvailableDates([]);
      } finally {
        if (active) {
          setDatesLoading(false);
        }
      }
    };

    void loadDates();

    return () => {
      active = false;
    };
  }, [appointment?.service, clinic?.slug, token]);

  // Cargar slots disponibles para la fecha seleccionada.
  // SIEMPRE pasa clinicSlug para que la API use clinic_hours.
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
      setErrorMessage("No se pudo reprogramar la cita. Intentalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          Cargando cita...
        </section>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="space-y-4">
        <section className="rounded-[24px] border border-slate-200 bg-white p-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Cita no encontrada</h1>
          <p className="mt-2 text-sm text-gray-600">Este enlace no corresponde a una cita activa.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HeaderBar
        logoText={clinic?.logoText ?? "RC"}
        clinicName={clinic?.name ?? appointment.clinicName}
        idLabel={appointment.idLabel}
        accentColor={clinic?.accentColor ?? "#1d4ed8"}
      />

      <AppointmentCard appointment={appointment} />

      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Selecciona un nuevo horario</h1>
        <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-sm font-semibold text-gray-900">Tu cita actual</p>
          <p className="mt-2 text-sm text-gray-700">{appointment.datetimeLabel}</p>
          <p className="mt-1 text-sm text-gray-600">{appointment.service}</p>
        </div>
        <p className="mt-2 text-sm text-gray-600">Selecciona un nuevo horario</p>
        <p className="mt-2 text-sm text-gray-600">
          Elige un nuevo horario disponible para reprogramar tu cita.
        </p>

        <div className="mt-4 space-y-2">
          <div className="rounded-[20px] border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-sm font-semibold text-gray-900">Elige un dia</p>
            {datesLoading ? (
              <p className="mt-2 text-sm text-gray-600">Cargando fechas disponibles...</p>
            ) : availableDates.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {availableDates.map((dateOption) => (
                  <button
                    key={dateOption.value}
                    type="button"
                    onClick={() => setSelectedDate(dateOption.value)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-150 ${
                      selectedDate === dateOption.value
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {dateOption.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">
                No hay dias disponibles para reprogramar esta cita.
              </p>
            )}
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
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 transition-all duration-150 hover:bg-gray-50 active:translate-y-[1px]"
                >
                  {slot.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No hay horarios disponibles para este dia. Prueba con otra fecha.</p>
          )}
        </div>
        {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
      </section>

      <Link
        href={`/a/${token}`}
        className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 active:translate-y-[1px]"
      >
        Volver a la cita
      </Link>

      <PatientFooter supportPhone={clinic?.supportPhone ?? null} />
    </div>
  );
}
