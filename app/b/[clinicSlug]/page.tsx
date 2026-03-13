"use client";

import type { CreateAppointmentInput } from "@/lib/appointments";
import { DEMO_CLINICS } from "@/lib/demoClinics";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
      description: "",
      address: directMatch.address,
      phone: "",
      logo_url: "",
      theme_color: directMatch.themeColor ?? "",
    };
  }

  const config = Object.values(DEMO_CLINICS).find((item) => item.clinicSlug === clinicSlug);
  return {
    clinicName: config?.clinicName ?? clinicSlug,
    description: "",
    address: config?.address ?? "",
    phone: "",
    logo_url: "",
    theme_color: config?.themeColor ?? "",
  };
}

export default function PublicBookingPage() {
  const params = useParams();
  const clinicSlug = params.clinicSlug as string;
  const [clinicDetails, setClinicDetails] = useState<{
    clinicName: string;
    description?: string;
    address?: string;
    phone?: string;
    logo_url?: string;
    theme_color?: string;
  } | null>(null);
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
  const [createdAppointment, setCreatedAppointment] = useState<{
    token: string;
    clinicName: string;
    service: string;
    datetimeLabel: string;
  } | null>(null);
  const [logoVisible, setLogoVisible] = useState(true);
  const whatsappLink =
    createdLink && createdAppointment
      ? `https://wa.me/?text=${encodeURIComponent(
          [
            `Cita confirmada en ${createdAppointment.clinicName}.`,
            `Servicio: ${createdAppointment.service}`,
            `Fecha: ${createdAppointment.datetimeLabel}`,
            `Gestiona tu cita aquí: ${createdLink}`,
          ].join("\n"),
        )}`
      : null;

  useEffect(() => {
    let active = true;

    const loadClinic = async () => {
      try {
        const response = await fetch(`/api/clinics?slug=${encodeURIComponent(clinicSlug)}`);
        const data = await response.json();

        if (!active) return;

        if (response.ok && data.clinic) {
          setClinicDetails({
            clinicName: data.clinic.name,
            description: data.clinic.description ?? "",
            address: data.clinic.address ?? "",
            phone: data.clinic.phone ?? "",
            logo_url: data.clinic.logo_url ?? "",
            theme_color: data.clinic.theme_color ?? "",
          });
        } else {
          const fallback = getClinicDetails(clinicSlug);
          setClinicDetails(fallback);
        }
      } catch {
        if (!active) return;
        const fallback = getClinicDetails(clinicSlug);
        setClinicDetails(fallback);
      }
    };

    void loadClinic();

    return () => {
      active = false;
    };
  }, [clinicSlug]);

  useEffect(() => {
    setLogoVisible(Boolean(clinicDetails?.logo_url));
  }, [clinicDetails?.logo_url]);

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
        clinic_name: clinicDetails?.clinicName ?? clinicSlug,
        patient_name: patientName.trim(),
        service: selectedService.name,
        scheduled_at: selectedSlot.value,
        datetime_label: datetimeLabel,
        address: clinicDetails?.address ?? "",
        duration_label: `${selectedService.duration_minutes} min`,
        status: "confirmed",
      };

      const response = await fetch("/api/appointments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        appointment?: {
          token: string;
          clinic_name: string;
          service: string;
          datetime_label: string;
        };
        error?: string;
      };

      if (!response.ok || !result.appointment) {
        throw new Error(result.error ?? "No se pudo crear la cita");
      }

      const fullLink =
        typeof window !== "undefined"
          ? `${window.location.origin}/a/${result.appointment.token}`
          : `/a/${result.appointment.token}`;

      setErrorMessage(null);
      setCreatedLink(fullLink);
      setCreatedAppointment({
        token: result.appointment.token,
        clinicName: result.appointment.clinic_name,
        service: result.appointment.service,
        datetimeLabel: result.appointment.datetime_label,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear la cita");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)] px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-6xl space-y-8">
        {clinicDetails && (
          <>
            <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/90 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.45)]">
              <div className="grid gap-8 px-6 py-8 md:px-8 md:py-9 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                <div className="space-y-6">
                  <div className="space-y-4">
                    {clinicDetails.logo_url && logoVisible ? (
                      <img
                        src={clinicDetails.logo_url}
                        alt={clinicDetails.clinicName}
                        className="h-12 object-contain"
                        onError={() => setLogoVisible(false)}
                      />
                    ) : null}

                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Reserva online
                      </p>
                      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 md:text-[2.75rem]">
                        {clinicDetails.clinicName}
                      </h1>
                      <p className="max-w-2xl text-base leading-7 text-slate-600">
                        {clinicDetails.description ||
                          "Reserva tu próxima cita en una experiencia clara, rápida y diseñada para una atención clínica moderna."}
                      </p>
                    </div>
                  </div>

                  {(clinicDetails.address || clinicDetails.phone) ? (
                    <div className="grid gap-3 md:max-w-xl md:grid-cols-2">
                      {clinicDetails.address ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinicDetails.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 transition-all duration-150 hover:border-slate-300 hover:bg-white"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Dirección
                          </p>
                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            {clinicDetails.address}
                          </p>
                        </a>
                      ) : null}

                      {clinicDetails.phone ? (
                        <a
                          href={`tel:${clinicDetails.phone}`}
                          className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 transition-all duration-150 hover:border-slate-300 hover:bg-white"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Teléfono
                          </p>
                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            {clinicDetails.phone}
                          </p>
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 md:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Reserva en pocos pasos</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                        Elige servicio, fecha y hora
                      </h2>
                    </div>
                    <div
                      className="hidden h-12 w-12 rounded-2xl border md:block"
                      style={{
                        borderColor: clinicDetails.theme_color || "#cbd5e1",
                        backgroundColor: clinicDetails.theme_color || "#e2e8f0",
                      }}
                    />
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        1
                      </p>
                      <p className="mt-2 text-sm text-slate-700">Selecciona el servicio.</p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        2
                      </p>
                      <p className="mt-2 text-sm text-slate-700">Escoge fecha y franja libre.</p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        3
                      </p>
                      <p className="mt-2 text-sm text-slate-700">Confirma con tu nombre.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/92 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.45)]">
              <div className="border-b border-slate-200/80 bg-slate-50/70 px-6 py-5 md:px-8">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Reserva tu cita
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  La disponibilidad se actualiza en tiempo real según la agenda de la clínica.
                </p>
              </div>

              <div className="grid gap-8 px-6 py-6 md:px-8 md:py-8 lg:grid-cols-[1fr_320px]">
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
                          Selecciona el hueco que mejor te encaje.
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
                                ? "border-transparent text-white shadow-[0_18px_34px_-22px_rgba(15,23,42,0.6)]"
                                : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                            style={
                              selectedSlot?.value === slot.value && clinicDetails.theme_color
                                ? { backgroundColor: clinicDetails.theme_color }
                                : undefined
                            }
                          >
                            {slot.label}
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-slate-600">
                          No hay horarios disponibles para este día.
                        </p>
                      )}
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">Nombre y apellidos</span>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(event) => setPatientName(event.target.value)}
                      placeholder="Ej: Marta García"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={submitting || !selectedService || !selectedSlot}
                    className="rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_34px_-22px_rgba(15,23,42,0.65)] transition-all duration-150 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: clinicDetails.theme_color ?? "#0f172a" }}
                  >
                    {submitting ? "Reservando..." : "Reservar cita"}
                  </button>

                  {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

                  {createdLink && createdAppointment ? (
                    <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4">
                      <p className="text-sm font-semibold text-emerald-900">Cita confirmada</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            Clínica
                          </p>
                          <p className="mt-2 text-sm font-medium text-emerald-950">
                            {createdAppointment.clinicName}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            Servicio
                          </p>
                          <p className="mt-2 text-sm font-medium text-emerald-950">
                            {createdAppointment.service}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            Fecha y hora
                          </p>
                          <p className="mt-2 text-sm font-medium text-emerald-950">
                            {createdAppointment.datetimeLabel}
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-emerald-700">
                        Desde este enlace podrás gestionar tu cita y consultar sus datos cuando lo necesites.
                      </p>
                      <Link
                        href={createdLink}
                        className="mt-3 block break-all text-sm font-medium text-emerald-900 underline"
                      >
                        {createdLink}
                      </Link>
                      {whatsappLink ? (
                        <a
                          href={whatsappLink}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex rounded-2xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition-all duration-150 hover:bg-emerald-100"
                        >
                          Enviar a WhatsApp
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </form>

                <aside className="space-y-4">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Qué incluye
                    </p>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                      <li>Disponibilidad actualizada con la agenda real.</li>
                      <li>Confirmación inmediata al completar la reserva.</li>
                      <li>Enlace individual para gestionar la cita.</li>
                    </ul>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Confianza
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Experiencia clara, directa y pensada para reservar sin fricción desde móvil o
                      escritorio.
                    </p>
                  </div>
                </aside>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
