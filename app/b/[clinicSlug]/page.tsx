"use client";

import type { CreateAppointmentInput } from "@/lib/appointments";
import {
  buildGoogleCalendarUrl,
  downloadIcsFile,
  parseDurationFromLabel,
} from "@/lib/calendarExport";
import { buildDateTimeLabelFromInputs, getTodayInputValue } from "@/lib/dateFormat";
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
  return crypto.randomUUID();
}

function getDateAndTimeLabels(appointment: Appointment): { dateLabel: string; timeLabel: string } {
  if (appointment.scheduledAt) {
    const scheduledAt = new Date(appointment.scheduledAt);

    if (!Number.isNaN(scheduledAt.getTime())) {
      return {
        dateLabel: new Intl.DateTimeFormat("es-ES", {
          weekday: "long",
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

  const [dateLabel, timeLabel = ""] = appointment.datetimeLabel.split("·").map((value) => value.trim());
  return { dateLabel, timeLabel };
}

function BookingConfirmation({
  appointment,
  manageLink,
  clinicAddress,
  onBookAnother,
}: {
  appointment: Appointment;
  manageLink: string;
  clinicAddress: string;
  onBookAnother: () => void;
}) {
  const labels = getDateAndTimeLabels(appointment);
  const durationMinutes = parseDurationFromLabel(appointment.durationLabel);

  const calendarInput = appointment.scheduledAt
    ? {
        title: `${appointment.service} — ${appointment.clinicName}`,
        description: [
          `Cita: ${appointment.service}`,
          `Clínica: ${appointment.clinicName}`,
          `Paciente: ${appointment.patientName}`,
          `Gestiona tu cita: ${manageLink}`,
        ].join("\n"),
        location: clinicAddress,
        startDate: new Date(appointment.scheduledAt),
        durationMinutes,
      }
    : null;

  const googleUrl = calendarInput ? buildGoogleCalendarUrl(calendarInput) : null;

  const whatsappText = [
    `*Cita confirmada en ${appointment.clinicName}*`,
    "",
    `Servicio: ${appointment.service}`,
    `Fecha: ${labels.dateLabel}`,
    `Hora: ${labels.timeLabel}`,
    "",
    `Gestiona tu cita: ${manageLink}`,
    `*Cancelar cita:* ${manageLink}/cancel`,
  ].join("\n");
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  return (
    <section className="overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
      <div className="px-6 py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-2xl space-y-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/20 bg-primary-soft">
              <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">
              Reserva confirmada
            </h2>
            <p className="mt-2 text-sm text-muted">
              Tu cita ha sido registrada correctamente.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[14px] border border-border bg-white p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Servicio
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {appointment.service}
              </p>
            </div>
            <div className="rounded-[14px] border border-border bg-white p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Fecha
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {labels.dateLabel}
              </p>
            </div>
            <div className="rounded-[14px] border border-border bg-white p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Hora
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {labels.timeLabel}
              </p>
            </div>
          </div>

          {calendarInput ? (
            <div className="rounded-[14px] border border-border bg-white p-5">
              <p className="text-sm font-semibold text-foreground">Añadir al calendario</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {googleUrl ? (
                  <a
                    href={googleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-[10px] border-[0.5px] border-border px-4 py-2.5 text-sm font-medium text-muted transition-all duration-150 hover:border-primary/30 hover:text-foreground"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 22h-15A2.5 2.5 0 012 19.5v-15A2.5 2.5 0 014.5 2H8v2H4.5a.5.5 0 00-.5.5v15a.5.5 0 00.5.5h15a.5.5 0 00.5-.5V16h2v3.5a2.5 2.5 0 01-2.5 2.5zM17 2h5v5h-2V4.41l-7.3 7.3-1.41-1.42L18.59 3H17V2zM8 11h8v2H8v-2zm0 4h5v2H8v-2z"/></svg>
                    Google Calendar
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => downloadIcsFile(calendarInput, "cita.ics")}
                  className="inline-flex items-center gap-2 rounded-[10px] border-[0.5px] border-border px-4 py-2.5 text-sm font-medium text-muted transition-all duration-150 hover:border-primary/30 hover:text-foreground"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  Apple Calendar
                </button>
                <button
                  type="button"
                  onClick={() => downloadIcsFile(calendarInput, `cita-${appointment.clinicName.toLowerCase().replace(/\s+/g, "-")}.ics`)}
                  className="inline-flex items-center gap-2 rounded-[10px] border-[0.5px] border-border px-4 py-2.5 text-sm font-medium text-muted transition-all duration-150 hover:border-primary/30 hover:text-foreground"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Descargar .ics
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-[10px] bg-[#25D366] px-5 py-2.5 font-heading text-sm font-semibold text-white transition-all duration-150 hover:brightness-95"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Enviar por WhatsApp
            </a>
            <Link
              href={manageLink}
              className="inline-flex items-center gap-2 rounded-[10px] border-[1.5px] border-primary bg-transparent px-5 py-2.5 font-heading text-sm font-semibold text-primary transition-all duration-150 hover:bg-primary-soft"
            >
              Gestionar mi cita
            </Link>
            <button
              type="button"
              onClick={onBookAnother}
              className="inline-flex items-center gap-2 rounded-[10px] border-[1.5px] border-primary bg-transparent px-5 py-2.5 font-heading text-sm font-semibold text-primary transition-all duration-150 hover:bg-primary-soft"
            >
              Reservar otra cita
            </button>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted/50">
            Reserva gestionada con{" "}
            <a href="https://appoclick.com" target="_blank" rel="noreferrer" className="hover:text-muted">
              Appoclick
            </a>
          </p>
        </div>
      </div>
    </section>
  );
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
    review_url?: string;
    offers_presencial?: boolean;
    offers_online?: boolean;
    logo_has_dark_bg?: boolean;
  } | null>(null);
  const [loadingClinic, setLoadingClinic] = useState(true);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [selectedDate, setSelectedDate] = useState(getTodayInputValue());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [modality, setModality] = useState<"presencial" | "online">("presencial");
  const [appointmentType, setAppointmentType] = useState<"primera_visita" | "revision">("primera_visita");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [privacidadAceptada, setPrivacidadAceptada] = useState(false);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [createdAppointment, setCreatedAppointment] = useState<Appointment | null>(null);
  const [logoVisible, setLogoVisible] = useState(true);

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
            review_url: data.clinic.review_url ?? "",
            offers_presencial: data.clinic.offers_presencial ?? true,
            offers_online: data.clinic.offers_online ?? false,
            logo_has_dark_bg: data.clinic.logo_has_dark_bg ?? false,
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
      if (!patientEmail.trim()) {
        throw new Error("Introduce tu email");
      }
      if (!privacidadAceptada) {
        throw new Error("Debes aceptar la política de privacidad para continuar");
      }

      const token = generateToken();
      const datetimeLabel = buildDateTimeLabelFromInputs(selectedDate, selectedSlot.label);
      const payload: CreateAppointmentInput = {
        token,
        clinic_id: null,
        clinic_name: clinicDetails.clinicName,
        patient_name: patientName.trim(),
        patient_email: patientEmail.trim(),
        patient_phone: patientPhone.trim() || null,
        service: selectedService.name,
        scheduled_at: selectedSlot.value,
        datetime_label: datetimeLabel,
        address: clinicDetails.address ?? "",
        duration_label: `${selectedService.duration_minutes} min`,
        status: "confirmed",
        modality,
        appointment_type: appointmentType,
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
    <div
      className="min-h-screen bg-background px-4 py-8 md:px-6 md:py-12"
      style={{ "--clinic-color": clinicDetails?.theme_color || "#0E9E82" } as React.CSSProperties}
    >
      <div className="mx-auto max-w-6xl space-y-4">
        {loadingClinic ? (
          <section className="rounded-[14px] border border-border bg-card px-6 py-10 text-center shadow-sm">
            <p className="text-sm text-muted">Cargando clinica...</p>
          </section>
        ) : clinicDetails ? (
          <>
            <section className="overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
              {clinicDetails.logo_url && logoVisible && clinicDetails.logo_has_dark_bg ? (
                <div
                  className="px-6 py-6 md:px-8"
                  style={{ backgroundColor: "var(--clinic-color)" }}
                >
                  <img
                    src={clinicDetails.logo_url}
                    alt={clinicDetails.clinicName}
                    className="h-12 object-contain"
                    onError={() => setLogoVisible(false)}
                  />
                </div>
              ) : null}
              <div className="px-6 py-5 md:px-8 md:py-6">
                <div className="max-w-3xl space-y-4">
                  <div className="space-y-3">
                    {clinicDetails.logo_url && logoVisible && !clinicDetails.logo_has_dark_bg ? (
                      <img
                        src={clinicDetails.logo_url}
                        alt={clinicDetails.clinicName}
                        className="h-12 object-contain"
                        onError={() => setLogoVisible(false)}
                      />
                    ) : null}

                    <div className="space-y-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                        Reserva online
                      </p>
                      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground md:text-[2.75rem]">
                        {clinicDetails.clinicName}
                      </h1>
                      <p className="max-w-2xl text-base leading-7 text-muted">
                        {clinicDetails.description ||
                          "¿Necesitas cambiar o cancelar tu cita? Usa el enlace que te enviamos por email."}
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
                          className="rounded-[14px] border border-border bg-white p-4 transition-all duration-150 hover:border-primary/30 hover:bg-primary-soft/30"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                            Dirección
                          </p>
                          <p className="mt-3 text-sm leading-6 text-foreground">
                            {clinicDetails.address}
                          </p>
                        </a>
                      ) : null}

                      {clinicDetails.phone ? (
                        <a
                          href={`tel:${clinicDetails.phone}`}
                          className="rounded-[14px] border border-border bg-white p-4 transition-all duration-150 hover:border-primary/30 hover:bg-primary-soft/30"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                            Teléfono
                          </p>
                          <p className="mt-3 text-sm leading-6 text-foreground">
                            {clinicDetails.phone}
                          </p>
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            {createdLink && createdAppointment ? (
              <BookingConfirmation
                appointment={createdAppointment}
                manageLink={createdLink}
                clinicAddress={clinicDetails.address ?? ""}
                onBookAnother={() => {
                  setCreatedLink(null);
                  setCreatedAppointment(null);
                  setPatientName("");
                  setPatientEmail("");
                  setPrivacidadAceptada(false);
                  setSelectedSlot(null);
                  setErrorMessage(null);
                }}
              />
            ) : (
            <section className="overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
              <div className="border-b border-border/80 bg-background px-6 py-5 md:px-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                  Reserva tu cita
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  Completa tu reserva
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Elige servicio, fecha, hora y confirma tu cita.
                </p>
              </div>

              <div className="px-6 py-6 md:px-8 md:py-8">
                <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block rounded-[14px] border border-border bg-white p-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
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
                        className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition-colors focus:border-[var(--clinic-color)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--clinic-color)_12%,transparent)]"
                        disabled={loadingServices || services.length === 0}
                      >
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block rounded-[14px] border border-border bg-white p-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
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
                        className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition-colors focus:border-[var(--clinic-color)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--clinic-color)_12%,transparent)]"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[14px] border border-border bg-white p-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                        Tipo de cita
                      </span>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAppointmentType("primera_visita")}
                          className={`flex-1 rounded-[10px] border px-3 py-2.5 text-sm font-medium font-heading transition-all duration-150 ${
                            appointmentType === "primera_visita"
                              ? "border-transparent text-white"
                              : "border-border bg-white text-foreground hover:border-[var(--clinic-color)]"
                          }`}
                          style={appointmentType === "primera_visita" ? { backgroundColor: "var(--clinic-color)" } : undefined}
                        >
                          Primera visita
                        </button>
                        <button
                          type="button"
                          onClick={() => setAppointmentType("revision")}
                          className={`flex-1 rounded-[10px] border px-3 py-2.5 text-sm font-medium font-heading transition-all duration-150 ${
                            appointmentType === "revision"
                              ? "border-transparent text-white"
                              : "border-border bg-white text-foreground hover:border-[var(--clinic-color)]"
                          }`}
                          style={appointmentType === "revision" ? { backgroundColor: "var(--clinic-color)" } : undefined}
                        >
                          Revisión
                        </button>
                      </div>
                    </div>

                    {(clinicDetails.offers_presencial && clinicDetails.offers_online) ? (
                      <div className="rounded-[14px] border border-border bg-white p-4">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                          Modalidad
                        </span>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => setModality("presencial")}
                            className={`flex-1 rounded-[10px] border px-3 py-2.5 text-sm font-medium font-heading transition-all duration-150 ${
                              modality === "presencial"
                                ? "border-transparent text-white"
                                : "border-border bg-white text-foreground hover:border-[var(--clinic-color)]"
                            }`}
                            style={modality === "presencial" ? { backgroundColor: "var(--clinic-color)" } : undefined}
                          >
                            Presencial
                          </button>
                          <button
                            type="button"
                            onClick={() => setModality("online")}
                            className={`flex-1 rounded-[10px] border px-3 py-2.5 text-sm font-medium font-heading transition-all duration-150 ${
                              modality === "online"
                                ? "border-transparent text-white"
                                : "border-border bg-white text-foreground hover:border-[var(--clinic-color)]"
                            }`}
                            style={modality === "online" ? { backgroundColor: "var(--clinic-color)" } : undefined}
                          >
                            Online
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[14px] border border-border bg-white p-5 md:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                          3. Hora disponible
                        </p>
                        <p className="mt-2 text-lg font-semibold text-foreground">Horas disponibles</p>
                      </div>
                      {loadingSlots ? (
                        <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted">
                          Cargando
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2.5">
                      {loadingSlots ? (
                        <p className="text-sm text-muted">Cargando disponibilidad...</p>
                      ) : slots.length > 0 ? (
                        slots.map((slot) => (
                          <button
                            key={slot.value}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`rounded-[10px] border px-4 py-2.5 text-sm font-medium font-heading transition-all duration-150 ${
                              selectedSlot?.value === slot.value
                                ? "border-transparent text-white"
                                : "border-border bg-white text-foreground hover:border-[var(--clinic-color)]"
                            }`}
                            style={
                              selectedSlot?.value === slot.value
                                ? { backgroundColor: "var(--clinic-color)" }
                                : undefined
                            }
                          >
                            {slot.label}
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-muted">
                          No hay horarios disponibles para este día.
                        </p>
                      )}
                    </div>
                  </div>

                  <label className="block rounded-[14px] border border-border bg-white p-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      4. Nombre y apellidos
                    </span>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(event) => setPatientName(event.target.value)}
                      placeholder="Ej: Marta Garcia"
                      className="mt-2 w-full rounded-2xl border border-border bg-white px-3.5 py-3 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>

                  <label className="block rounded-[14px] border border-border bg-white p-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      5. Teléfono (opcional)
                    </span>
                    <input
                      type="tel"
                      value={patientPhone}
                      onChange={(event) => setPatientPhone(event.target.value)}
                      placeholder="Ej: 600 000 000"
                      className="mt-2 w-full rounded-2xl border border-border bg-white px-3.5 py-3 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>

                  <label className="block rounded-[14px] border border-border bg-white p-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      6. Email *
                    </span>
                    <input
                      type="email"
                      value={patientEmail}
                      onChange={(event) => setPatientEmail(event.target.value)}
                      placeholder="Ej: marta@email.com"
                      required
                      className="mt-2 w-full rounded-2xl border border-border bg-white px-3.5 py-3 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300"
                    />
                  </label>

                  <div className="space-y-4 pt-2">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={privacidadAceptada}
                        onChange={(event) => setPrivacidadAceptada(event.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-[var(--clinic-color)]"
                        required
                      />
                      <span className="text-sm text-muted">
                        He leído y acepto la{" "}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-foreground underline"
                        >
                          política de privacidad
                        </a>
                        . Consiento el tratamiento de mis datos para gestionar mi cita.
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={submitting || !selectedService || !selectedSlot || !clinicDetails || !patientEmail.trim() || !privacidadAceptada}
                      className="w-full rounded-[10px] px-5 py-3 font-heading text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                      style={{ backgroundColor: "var(--clinic-color)" }}
                    >
                      {submitting ? "Reservando..." : "Confirmar reserva"}
                    </button>
                  </div>

                  {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
                </form>
              </div>
            </section>
            )}
          </>
        ) : (
          <section className="rounded-[32px] border border-white/70 bg-white/92 px-6 py-10 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.45)]">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                Reserva online
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
                Clínica no disponible
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted">
                {errorMessage ?? "No se pudo cargar la clínica o este enlace ya no está disponible."}
              </p>
            </div>
          </section>
        )}
        <footer className="mt-8 text-center text-xs text-muted">
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            Política de privacidad
          </a>
          <span className="mx-2">·</span>
          <a href="/legal" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            Aviso legal
          </a>
          <span className="mx-2">·</span>
          <a href="https://appoclick.com" target="_blank" rel="noreferrer" className="hover:text-foreground">
            Reservas gestionadas con AppoClick
          </a>
        </footer>
      </div>
    </div>
  );
}
