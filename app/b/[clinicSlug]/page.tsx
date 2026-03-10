"use client";

import { DEMO_CLINICS } from "@/lib/demoClinics";
import type { CreateAppointmentInput } from "@/lib/appointments";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ServiceOption = {
  id: string;
  clinic_slug: string;
  name: string;
  duration_minutes: number;
  active: boolean;
};

type AvailabilitySlot = {
  value: string;
  label: string;
};

function generateToken(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `cita-${Date.now().toString(36)}-${random}`.toLowerCase();
}

function getTodayInputValue(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDateTimeLabel(dateInput: string, timeInput: string): string {
  const date = new Date(`${dateInput}T${timeInput}:00`);
  if (Number.isNaN(date.getTime())) {
    return `${dateInput} · ${timeInput}`;
  }

  const weekday = new Intl.DateTimeFormat("es-ES", { weekday: "long" }).format(date);
  const weekdayTitle = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}`;
  return `${weekdayTitle} · ${timeInput}`;
}

function getClinicDetails(clinicSlug: string) {
  const directMatch = DEMO_CLINICS[clinicSlug];
  if (directMatch) {
    return {
      clinicName: directMatch.clinicName,
      address: directMatch.address,
    };
  }

  const config = Object.values(DEMO_CLINICS).find((item) => item.clinicSlug === clinicSlug);
  return {
    clinicName: config?.clinicName ?? clinicSlug,
    address: config?.address ?? "",
  };
}

export default function PublicBookingPage() {
  const params = useParams();
  const clinicSlug = params.clinicSlug as string;
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayInputValue());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [patientName, setPatientName] = useState("");
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  const clinicDetails = useMemo(() => getClinicDetails(clinicSlug), [clinicSlug]);

  useEffect(() => {
    let active = true;

    const loadServices = async () => {
      setLoadingServices(true);
      try {
        const response = await fetch(`/api/services?clinicSlug=${encodeURIComponent(clinicSlug)}`);
        const data = (await response.json()) as { services?: ServiceOption[]; error?: string };

        if (!active) return;

        const nextServices = response.ok ? (data.services ?? []) : [];
        setServices(nextServices);
        setSelectedService(nextServices[0] ?? null);
        setErrorMessage(response.ok ? null : (data.error ?? "No se pudieron cargar los servicios"));
      } catch {
        if (!active) return;
        setServices([]);
        setSelectedService(null);
        setErrorMessage("No se pudieron cargar los servicios");
      } finally {
        if (active) {
          setLoadingServices(false);
        }
      }
    };

    void loadServices();

    return () => {
      active = false;
    };
  }, [clinicSlug]);

  useEffect(() => {
    let active = true;

    const loadSlots = async () => {
      if (!selectedService || !selectedDate) {
        setSlots([]);
        setSelectedSlot(null);
        setLoadingSlots(false);
        return;
      }

      setLoadingSlots(true);
      try {
        const searchParams = new URLSearchParams({
          date: selectedDate,
          clinicSlug,
          service: selectedService.name,
        });
        const response = await fetch(`/api/availability?${searchParams.toString()}`);
        const data = (await response.json()) as { slots?: AvailabilitySlot[] };

        if (!active) return;

        const nextSlots = response.ok ? (data.slots ?? []) : [];
        setSlots(nextSlots);
        setSelectedSlot((prev) =>
          prev && nextSlots.some((slot) => slot.value === prev.value) ? prev : null,
        );
      } catch {
        if (!active) return;
        setSlots([]);
        setSelectedSlot(null);
      } finally {
        if (active) {
          setLoadingSlots(false);
        }
      }
    };

    void loadSlots();

    return () => {
      active = false;
    };
  }, [clinicSlug, selectedDate, selectedService]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (!selectedService) {
        throw new Error("Selecciona un servicio");
      }
      if (!selectedSlot) {
        throw new Error("Selecciona una hora disponible");
      }
      if (!patientName.trim()) {
        throw new Error("Introduce tu nombre");
      }

      const token = generateToken();
      const datetimeLabel = buildDateTimeLabel(selectedDate, selectedSlot.label);
      const payload: CreateAppointmentInput = {
        token,
        clinic_id: null,
        clinic_name: clinicDetails.clinicName,
        patient_name: patientName.trim(),
        service: selectedService.name,
        scheduled_at: selectedSlot.value,
        datetime_label: datetimeLabel,
        address: clinicDetails.address,
        duration_label: `${selectedService.duration_minutes} min`,
        status: "pending",
      };

      const response = await fetch("/api/appointments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { appointment?: { token: string }; error?: string };

      if (!response.ok || !result.appointment) {
        throw new Error(result.error ?? "No se pudo crear la cita");
      }

      const fullLink =
        typeof window !== "undefined"
          ? `${window.location.origin}/a/${result.appointment.token}`
          : `/a/${result.appointment.token}`;

      setErrorMessage(null);
      setCreatedLink(fullLink);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear la cita");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Reserva tu cita</h1>
          <p className="mt-2 text-sm text-gray-600">{clinicDetails.clinicName}</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Servicio</span>
              <select
                value={selectedService?.id ?? ""}
                onChange={(event) => {
                  const nextService = services.find((item) => item.id === event.target.value) ?? null;
                  setSelectedService(nextService);
                  setSelectedSlot(null);
                }}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                disabled={loadingServices || services.length === 0}
              >
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Fecha</span>
              <input
                type="date"
                value={selectedDate}
                min={getTodayInputValue()}
                onChange={(event) => {
                  setSelectedDate(event.target.value);
                  setSelectedSlot(null);
                }}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </label>

            <div>
              <p className="text-sm font-medium text-gray-700">Horas disponibles</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {loadingSlots ? (
                  <p className="text-sm text-gray-600">Cargando disponibilidad...</p>
                ) : slots.length > 0 ? (
                  slots.map((slot) => (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-sm transition-all duration-150 ${
                        selectedSlot?.value === slot.value
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">No hay horarios disponibles para este día.</p>
                )}
              </div>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Nombre y apellidos</span>
              <input
                type="text"
                value={patientName}
                onChange={(event) => setPatientName(event.target.value)}
                placeholder="Ej: Marta García"
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
              />
            </label>

            <button
              type="submit"
              disabled={submitting || !selectedService || !selectedSlot}
              className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Reservando..." : "Reservar cita"}
            </button>
          </form>

          {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}

          {createdLink ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Cita creada correctamente</p>
              <p className="mt-1 text-sm text-emerald-700">Tu enlace de cita:</p>
              <Link
                href={createdLink}
                className="mt-2 block break-all text-sm font-medium text-emerald-900 underline"
              >
                {createdLink}
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
