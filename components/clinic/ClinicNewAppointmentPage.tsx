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

type ClinicNewAppointmentPageProps = {
  clinicSlug?: string;
  basePath?: string;
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

function ClinicNewAppointmentContent({
  clinicSlug,
  basePath,
}: {
  clinicSlug: string;
  basePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [selectedDate, setSelectedDate] = useState(searchParams.get("date") ?? getTodayInputValue());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
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
        patient_email: patientEmail.trim() || null,
        patient_phone: phone.trim() || null,
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
        body: JSON.stringify({
          ...payload,
          clinicSlug,
        }),
      });

      const result = (await response.json()) as { appointment?: { token: string }; error?: string };

      if (!response.ok || !result.appointment) {
        throw new Error(result.error ?? "No se pudo crear la cita");
      }

      router.push(basePath);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear la cita");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.4)]">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.14),_transparent_38%),linear-gradient(180deg,_rgba(248,250,252,0.95),_rgba(255,255,255,0.98))] p-7 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Operativa clínica
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 md:text-[2rem]">
                Nueva cita
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Crea una reserva manual con los mismos servicios y disponibilidad reales que ya usa
                la experiencia pública.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Clínica activa
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {loadingClinic ? "Cargando clínica..." : clinic?.name ?? "Clínica"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.4)]">
        <div className="border-b border-slate-200/80 bg-slate-50/70 px-6 py-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Datos de la cita
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Selecciona servicio, fecha y horario antes de completar los datos del paciente.
          </p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Servicio</span>
                <select
                  value={selectedService?.id ?? ""}
                  onChange={(event) => {
                    const nextService =
                      services.find((item) => item.id === event.target.value) ?? null;
                    setSelectedService(nextService);
                    setSelectedSlot(null);
                  }}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-300"
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
                <span className="text-sm font-medium text-slate-700">Fecha</span>
                <input
                  type="date"
                  value={selectedDate}
                  min={getTodayInputValue()}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSelectedSlot(null);
                  }}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-300"
                />
              </label>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Horas disponibles</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Se muestran solo los huecos libres para el servicio seleccionado.
                  </p>
                </div>
                {loadingSlots ? (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                    Cargando
                  </span>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap gap-2.5">
                {loadingSlots ? (
                  <p className="text-sm text-slate-600">Cargando disponibilidad...</p>
                ) : slots.length > 0 ? (
                  slots.map((slot) => (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm transition-all duration-150 ${
                        selectedSlot?.value === slot.value
                          ? "border-slate-950 bg-slate-950 text-white shadow-[0_16px_30px_-22px_rgba(15,23,42,0.6)]"
                          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {slot.label}
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-600">No hay horarios disponibles para este día.</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Nombre del paciente</span>
                <input
                  type="text"
                  value={patientName}
                  onChange={(event) => setPatientName(event.target.value)}
                  placeholder="Ej: Marta García"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Teléfono</span>
                <input
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Ej: 600 123 123"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300"
                />
                {phoneHelper ? (
                  <p className="mt-2 text-xs text-slate-500">Teléfono introducido: {phoneHelper}</p>
                ) : null}
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={patientEmail}
                onChange={(event) => setPatientEmail(event.target.value)}
                placeholder="Ej: marta@email.com"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300"
              />
            </label>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting || !selectedService || !selectedSlot || !clinic}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_-22px_rgba(15,23,42,0.7)] transition-all duration-150 hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creando..." : "Crear cita"}
              </button>
              <button
                type="button"
                onClick={() => router.push(basePath)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </form>

          {errorMessage ? <p className="mt-5 text-sm text-red-600">{errorMessage}</p> : null}
        </div>
      </section>
    </div>
  );
}

export function ClinicNewAppointmentPage({
  clinicSlug = PANEL_CLINIC_SLUG,
  basePath = "/clinic",
}: ClinicNewAppointmentPageProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <section className="overflow-hidden rounded-[30px] border border-white/70 bg-white/90 p-7 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.4)] md:p-8">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Nueva cita</h1>
            <p className="mt-3 text-sm text-slate-600">Cargando clínica...</p>
          </section>

          <section className="overflow-hidden rounded-[30px] border border-white/70 bg-white/90 p-6 shadow-[0_30px_80px_-42px_rgba(15,23,42,0.4)]">
            <p className="text-sm text-slate-600">Cargando formulario...</p>
          </section>
        </div>
      }
    >
      <ClinicNewAppointmentContent clinicSlug={clinicSlug} basePath={basePath} />
    </Suspense>
  );
}

export default function ClinicNewAppointmentRoute() {
  return <ClinicNewAppointmentPage />;
}
