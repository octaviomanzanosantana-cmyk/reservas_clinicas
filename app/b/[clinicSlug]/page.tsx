"use client";

import type { CreateAppointmentInput } from "@/lib/appointments";
import type { Appointment } from "@/lib/types";
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

function buildGoogleCalendarUrl(appointment: Appointment): string | null {
  if (!appointment.scheduledAt) return null;

  const start = new Date(appointment.scheduledAt);
  if (Number.isNaN(start.getTime())) return null;

  const durationMatch = appointment.durationLabel.match(/\d+/);
  const durationMinutes = durationMatch ? Number(durationMatch[0]) : 30;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const formatGoogleDate = (date: Date) =>
    date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: appointment.service,
    dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
    details: `Cita: ${appointment.service}\nClinica: ${appointment.clinicName}`,
    location: appointment.address,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getDateAndTimeLabels(appointment: Appointment): { dateLabel: string; timeLabel: string } {
  if (appointment.scheduledAt) {
    const scheduledAt = new Date(appointment.scheduledAt);

    if (!Number.isNaN(scheduledAt.getTime())) {
      return {
        dateLabel: new Intl.DateTimeFormat("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }).format(scheduledAt),
        timeLabel: new Intl.DateTimeFormat("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        }).format(scheduledAt),
      };
    }
  }

  const [dateLabel, timeLabel = ""] = appointment.datetimeLabel.split("Â·").map((value) => value.trim());
  return { dateLabel, timeLabel };
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
  const [loadingClinic, setLoadingClinic] = useState(true);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayInputValue());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [patientName, setPatientName] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);
  const [logoVisible, setLogoVisible] = useState(true);
  const createdCalendarLink = createdAppointment ? buildGoogleCalendarUrl(createdAppointment) : null;
  const createdDateTime = createdAppointment ? getDateAndTimeLabels(createdAppointment) : null;
  const whatsappLink =
    createdLink && createdAppointment
      ? `https://wa.me/?text=${encodeURIComponent(
          [
            `Cita confirmada en ${createdAppointment.clinicName}.`,
            `Servicio: ${createdAppointment.service}`,
            `Fecha: ${createdAppointment.datetimeLabel}`,
            `Gestiona tu cita aqui: ${createdLink}`,
          ].join("\n"),
        )}`
      : null;

  useEffect(() => {
    let active = true;

    const loadClinic = async () => {
      setLoadingClinic(true);
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
          setErrorMessage(null);
        } else {
          setClinicDetails(null);
          setErrorMessage(data.error ?? "No se pudo cargar la clinica");
        }
      } catch {
        if (!active) return;
        setClinicDetails(null);
        setErrorMessage("No se pudo cargar la clinica");
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
    setLogoVisible(Boolean(clinicDetails?.logo_url));
  }, [clinicDetails?.logo_url]);

  useEffect(() => {
    let active = true;

    const loadServices = async () => {
      if (!clinicDetails) {
        setServices([]);
        setSelectedService(null);
        setLoadingServices(false);
        return;
      }

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
  }, [clinicDetails, clinicSlug]);

  useEffect(() => {
    let active = true;

    const loadSlots = async () => {
      if (!clinicDetails || !selectedService || !selectedDate) {
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
  }, [clinicDetails, clinicSlug, selectedDate, selectedService]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (!clinicDetails) {
        throw new Error("No se pudo resolver la clinica");
      }
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
        patient_email: patientEmail.trim() || null,
        service: selectedService.name,
        scheduled_at: selectedSlot.value,
        datetime_label: datetimeLabel,
        address: clinicDetails.address ?? "",
        duration_label: `${selectedService.duration_minutes} min`,
        status: "confirmed",
      };

      const response = await fetch("/api/appointments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          clinicSlug,
        }),
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
        scheduledAt: selectedSlot.value,
        patientName: patientName.trim(),
        address: clinicDetails.address ?? "",
        durationLabel: `${selectedService.duration_minutes} min`,
        status: "confirmed",
        lastUpdateLabel: "",
        idLabel: result.appointment.token,
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
        {loadingClinic ? (
          <section className="rounded-[32px] border border-white/70 bg-white/92 px-6 py-10 text-center shadow-[0_30px_90px_-48px_rgba(15,23,42,0.45)]">
            <p className="text-sm text-slate-600">Cargando clinica...</p>
          </section>
        ) : clinicDetails ? (
          <>
            <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/90 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.45)]">
              <div className="px-6 py-8 md:px-8 md:py-9">
                <div className="max-w-3xl space-y-6">
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
                          "Reserva tu proxima cita en una experiencia clara, rapida y disenada para una atencion clinica moderna."}
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
                            Direccion
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
                            Telefono
                          </p>
                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            {clinicDetails.phone}
                          </p>
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/92 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.45)]">
              <div className="border-b border-slate-200/80 bg-slate-50/70 px-6 py-5 md:px-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Reserva tu cita
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                  Completa tu reserva
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Elige servicio, fecha, hora y confirma tu cita.
                </p>
              </div>

              <div className="px-6 py-6 md:px-8 md:py-8">
                <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        1. Servicio
                      </span>
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

                    <label className="block rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        2. Fecha
                      </span>
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

                  <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 shadow-sm md:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          3. Hora disponible
                        </p>
                        <p className="mt-2 text-lg font-semibold text-slate-950">Horas disponibles</p>
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
                          No hay horarios disponibles para este dia.
                        </p>
                      )}
                    </div>
                  </div>

                  <label className="block rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      4. Nombre y apellidos
                    </span>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(event) => setPatientName(event.target.value)}
                      placeholder="Ej: Marta Garcia"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>

                  <label className="block rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      5. Email
                    </span>
                    <input
                      type="email"
                      value={patientEmail}
                      onChange={(event) => setPatientEmail(event.target.value)}
                      placeholder="Ej: marta@email.com"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      6. Confirmar reserva
                    </p>
                    <button
                      type="submit"
                      disabled={submitting || !selectedService || !selectedSlot || !clinicDetails}
                      className="mt-3 w-full rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-[0_18px_34px_-22px_rgba(15,23,42,0.65)] transition-all duration-150 hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                      style={{ backgroundColor: clinicDetails.theme_color ?? "#0f172a" }}
                    >
                      {submitting ? "Reservando..." : "Confirmar reserva"}
                    </button>
                  </div>

                  {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

                  {createdLink && createdAppointment ? (
                    <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Reserva completada
                      </p>
                      <p className="mt-2 text-base font-semibold text-emerald-900">Cita confirmada</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
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
                            Fecha
                          </p>
                          <p className="mt-2 text-sm font-medium text-emerald-950">
                            {createdDateTime?.dateLabel ?? createdAppointment.datetimeLabel}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            Hora
                          </p>
                          <p className="mt-2 text-sm font-medium text-emerald-950">
                            {createdDateTime?.timeLabel ?? ""}
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-emerald-700">
                        Desde este enlace podras gestionar tu cita y consultar sus datos cuando lo necesites.
                      </p>
                      <Link
                        href={createdLink}
                        className="mt-3 block break-all text-sm font-medium text-emerald-900 underline"
                      >
                        {createdLink}
                      </Link>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setCreatedLink(null);
                            setCreatedAppointment(null);
                            setPatientName("");
                            setPatientEmail("");
                            setSelectedSlot(null);
                            setErrorMessage(null);
                          }}
                          className="inline-flex rounded-2xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition-all duration-150 hover:bg-emerald-100"
                        >
                          Reservar otra cita
                        </button>
                        {createdCalendarLink ? (
                          <a
                            href={createdCalendarLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-2xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition-all duration-150 hover:bg-emerald-100"
                          >
                            Anadir a calendario
                          </a>
                        ) : null}
                        {whatsappLink ? (
                          <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex rounded-2xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition-all duration-150 hover:bg-emerald-100"
                          >
                            Enviar por WhatsApp
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </form>
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-[32px] border border-white/70 bg-white/92 px-6 py-10 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.45)]">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Reserva online
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                Clinica no disponible
              </h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {errorMessage ?? "No se pudo cargar la clinica o este enlace ya no esta disponible."}
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
