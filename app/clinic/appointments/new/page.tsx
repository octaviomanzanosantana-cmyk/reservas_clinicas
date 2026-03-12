"use client";

import type { CreateAppointmentInput } from "@/lib/appointments";
import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

type ClinicData = {
  name: string;
  address: string | null;
};

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

function ClinicNewAppointmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clinicSlug = PANEL_CLINIC_SLUG;
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [selectedDate, setSelectedDate] = useState(searchParams.get("date") ?? getTodayInputValue());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState(searchParams.get("phone") ?? "");
  const [loadingClinic, setLoadingClinic] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requestedTime = searchParams.get("time") ?? "";

  useEffect(() => {
    let active = true;

    const loadClinic = async () => {
      setLoadingClinic(true);
      try {
        const response = await fetch(`/api/clinics?slug=${encodeURIComponent(clinicSlug)}`);
        const data = await response.json();

        if (!active) return;

        if (!response.ok || !data.clinic) {
          throw new Error(data.error ?? "No se pudo cargar la clínica");
        }

        setClinic(data.clinic as ClinicData);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar la clínica");
      } finally {
        if (active) {
          setLoadingClinic(false);
        }
      }
    };

    void loadClinic();

    return () => {
      active = false;
    };
  }, [clinicSlug]);

  useEffect(() => {
    let active = true;

    const loadServices = async () => {
      setLoadingServices(true);
      try {
        const response = await fetch(`/api/services?clinicSlug=${encodeURIComponent(clinicSlug)}`);
        const data = (await response.json()) as { services?: ServiceOption[]; error?: string };

        if (!active) return;

        if (!response.ok) {
          throw new Error(data.error ?? "No se pudieron cargar los servicios");
        }

        const nextServices = data.services ?? [];
        setServices(nextServices);
        setSelectedService(nextServices[0] ?? null);
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los servicios");
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
        return;
      }

      setLoadingSlots(true);
      try {
        const query = new URLSearchParams({
          date: selectedDate,
          clinicSlug,
          service: selectedService.name,
        });
        const response = await fetch(`/api/availability?${query.toString()}`);
        const data = (await response.json()) as { slots?: AvailabilitySlot[]; error?: string };

        if (!active) return;

        if (!response.ok) {
          throw new Error(data.error ?? "No se pudo cargar la disponibilidad");
        }

        const nextSlots = data.slots ?? [];
        setSlots(nextSlots);

        const nextSelected = requestedTime
          ? nextSlots.find((slot) => slot.label === requestedTime) ?? null
          : null;

        setSelectedSlot((prev) =>
          nextSelected ??
          (prev && nextSlots.some((slot) => slot.value === prev.value) ? prev : null),
        );
      } catch (error) {
        if (!active) return;
        setSlots([]);
        setSelectedSlot(null);
        setErrorMessage(
          error instanceof Error ? error.message : "No se pudo cargar la disponibilidad",
        );
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
  }, [clinicSlug, requestedTime, selectedDate, selectedService]);

  const phoneHelper = useMemo(() => phone.trim(), [phone]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (!clinic?.name) {
        throw new Error("No se pudo resolver la clínica");
      }
      if (!selectedService) {
        throw new Error("Selecciona un servicio");
      }
      if (!selectedSlot) {
        throw new Error("Selecciona una hora disponible");
      }
      if (!patientName.trim()) {
        throw new Error("Introduce el nombre del paciente");
      }

      const payload: CreateAppointmentInput = {
        token: generateToken(),
        clinic_id: null,
        clinic_name: clinic.name,
        patient_name: patientName.trim(),
        service: selectedService.name,
        scheduled_at: selectedSlot.value,
        datetime_label: buildDateTimeLabel(selectedDate, selectedSlot.label),
        address: clinic.address ?? "",
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

      router.push("/clinic");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear la cita");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Nueva cita</h1>
        <p className="mt-2 text-sm text-gray-600">
          {loadingClinic ? "Cargando clínica..." : clinic?.name ?? "Clínica"}
        </p>
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
                        ? "border-gray-900 bg-gray-900 text-white"
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
            <span className="text-sm font-medium text-gray-700">Nombre del paciente</span>
            <input
              type="text"
              value={patientName}
              onChange={(event) => setPatientName(event.target.value)}
              placeholder="Ej: Marta García"
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Teléfono</span>
            <input
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Ej: 600 123 123"
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
            {phoneHelper ? (
              <p className="mt-2 text-xs text-gray-500">Teléfono introducido: {phoneHelper}</p>
            ) : null}
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || !selectedService || !selectedSlot || !clinic}
              className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Creando..." : "Crear cita"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/clinic")}
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all duration-150 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>

        {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}
      </section>
    </div>
  );
}

export default function ClinicNewAppointmentPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Nueva cita</h1>
            <p className="mt-2 text-sm text-gray-600">Cargando clínica...</p>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-600">Cargando formulario...</p>
          </section>
        </div>
      }
    >
      <ClinicNewAppointmentContent />
    </Suspense>
  );
}
