"use client";

import { canUseFeature } from "@/lib/plan";
import type { Plan } from "@/lib/plan";
import { getTodayInputValue, toDateInputValue } from "@/lib/dateFormat";
import Link from "next/link";
import { useEffect, useState } from "react";

export type EditableAppointment = {
  token: string;
  patient_name: string;
  patient_email?: string | null;
  patient_phone?: string | null;
  modality?: string | null;
  video_link?: string | null;
  service: string;
  scheduled_at: string | null;
  datetime_label: string;
  status?: string | null;
};

type AvailabilitySlot = { value: string; label: string };

export type ReschedulePayload = {
  token: string;
  new_scheduled_at: string;
  notify_patient: boolean;
};

type EditAppointmentModalProps = {
  appointment: EditableAppointment;
  clinicSlug: string;
  clinicPlan: string;
  basePath: string;
  formatDate: (scheduledAt: string | null, fallback: string) => string;
  onSavePatient: (data: {
    token: string;
    patient_name: string;
    patient_email: string | null;
    patient_phone: string | null;
    modality: string;
    video_link: string | null;
  }) => Promise<void>;
  onReschedule?: (data: ReschedulePayload) => Promise<void>;
  onClose: () => void;
};

const RESCHEDULE_BLOCKED_STATUSES = new Set(["completed", "cancelled", "no_show"]);

export function EditAppointmentModal({
  appointment,
  clinicSlug,
  clinicPlan,
  basePath,
  formatDate,
  onSavePatient,
  onReschedule,
  onClose,
}: EditAppointmentModalProps) {
  // --- Sección 1: datos del paciente ---
  const [name, setName] = useState(appointment.patient_name);
  const [email, setEmail] = useState(appointment.patient_email ?? "");
  const [phone, setPhone] = useState(appointment.patient_phone ?? "");
  const [modality, setModality] = useState<"presencial" | "online">(
    appointment.modality === "online" ? "online" : "presencial",
  );
  const [videoLink, setVideoLink] = useState(appointment.video_link ?? "");
  const [savingPatient, setSavingPatient] = useState(false);
  const [patientError, setPatientError] = useState<string | null>(null);

  // --- Sección 2: reagendar cita ---
  const isPastAppointment = (() => {
    if (!appointment.scheduled_at) return false;
    const dt = new Date(appointment.scheduled_at);
    return !Number.isNaN(dt.getTime()) && dt.getTime() <= Date.now();
  })();

  const status = appointment.status?.trim() ?? "";
  const rescheduleAvailable =
    Boolean(onReschedule) &&
    !isPastAppointment &&
    !RESCHEDULE_BLOCKED_STATUSES.has(status);

  const initialDate = (() => {
    if (!appointment.scheduled_at) return getTodayInputValue();
    const dt = new Date(appointment.scheduled_at);
    if (Number.isNaN(dt.getTime())) return getTodayInputValue();
    return toDateInputValue(dt);
  })();

  const [rescheduleDate, setRescheduleDate] = useState(initialDate);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [notifyPatient, setNotifyPatient] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  useEffect(() => {
    if (!rescheduleAvailable) return;
    let active = true;

    const loadSlots = async () => {
      setSlotsLoading(true);
      setSlotsError(null);
      setSelectedSlot(null);

      try {
        const params = new URLSearchParams({
          clinicSlug,
          date: rescheduleDate,
          excludeToken: appointment.token,
        });
        if (appointment.service) {
          params.set("service", appointment.service);
        }
        const response = await fetch(`/api/availability?${params.toString()}`);
        const data = (await response.json()) as { slots?: AvailabilitySlot[]; error?: string };

        if (!active) return;

        if (!response.ok) {
          throw new Error(data.error ?? "No se pudo cargar la disponibilidad");
        }
        setSlots(data.slots ?? []);
      } catch (err) {
        if (!active) return;
        setSlots([]);
        setSlotsError(err instanceof Error ? err.message : "No se pudo cargar la disponibilidad");
      } finally {
        if (active) setSlotsLoading(false);
      }
    };

    void loadSlots();
    return () => {
      active = false;
    };
  }, [appointment.service, appointment.token, clinicSlug, rescheduleAvailable, rescheduleDate]);

  const handleSavePatient = async () => {
    if (!name.trim()) {
      setPatientError("El nombre es obligatorio");
      return;
    }
    setSavingPatient(true);
    setPatientError(null);
    try {
      await onSavePatient({
        token: appointment.token,
        patient_name: name.trim(),
        patient_email: email.trim() || null,
        patient_phone: phone.trim() || null,
        modality,
        video_link: modality === "online" ? videoLink.trim() || null : null,
      });
    } catch (err) {
      setPatientError(err instanceof Error ? err.message : "No se pudo actualizar");
      setSavingPatient(false);
    }
  };

  const handleReschedule = async () => {
    if (!onReschedule || !selectedSlot) return;
    setRescheduling(true);
    setRescheduleError(null);
    try {
      await onReschedule({
        token: appointment.token,
        new_scheduled_at: selectedSlot.value,
        notify_patient: notifyPatient,
      });
    } catch (err) {
      setRescheduleError(err instanceof Error ? err.message : "No se pudo reagendar la cita");
      setRescheduling(false);
    }
  };

  const initialPatientName = appointment.patient_name;
  const initialPatientEmail = appointment.patient_email ?? "";
  const initialPatientPhone = appointment.patient_phone ?? "";
  const initialModality: "presencial" | "online" =
    appointment.modality === "online" ? "online" : "presencial";
  const initialVideoLink = appointment.video_link ?? "";

  const patientDirty =
    name !== initialPatientName ||
    email !== initialPatientEmail ||
    phone !== initialPatientPhone ||
    modality !== initialModality ||
    videoLink !== initialVideoLink;
  const rescheduleDirty = selectedSlot !== null;
  const hasUnsavedChanges = patientDirty || rescheduleDirty;

  const handleClose = () => {
    if (savingPatient || rescheduling) return; // operación en curso
    if (
      hasUnsavedChanges &&
      !window.confirm("Tienes cambios sin guardar. ¿Seguro que quieres cerrar?")
    ) {
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleClose}
    >
      <div
        className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[14px] border-[0.5px] border-[#E5E7EB] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg font-semibold text-foreground">Editar cita</h2>
            <p className="mt-1 text-sm text-muted">
              {appointment.service} · {formatDate(appointment.scheduled_at, appointment.datetime_label)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
            className="-mr-2 -mt-2 shrink-0 rounded-full p-2 text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-foreground"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Sección 1: Datos del paciente */}
        <section className="mt-5 border-t border-[#F3F4F6] pt-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6B7280]">
            Datos del paciente
          </h3>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground">Nombre completo</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-[10px] border-[1.5px] border-[#E5E7EB] px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-[#0E9E82]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-foreground">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-[10px] border-[1.5px] border-[#E5E7EB] px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-[#0E9E82]"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-foreground">Teléfono</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5 w-full rounded-[10px] border-[1.5px] border-[#E5E7EB] px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-[#0E9E82]"
              />
            </label>
            <div>
              <span className="text-sm font-medium text-foreground">Modalidad</span>
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModality("presencial");
                    setVideoLink("");
                  }}
                  className={`flex-1 rounded-[10px] border px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    modality === "presencial"
                      ? "border-[#0E9E82] bg-[#0E9E82] text-white"
                      : "border-[#E5E7EB] bg-white text-[#6B7280]"
                  }`}
                >
                  Presencial
                </button>
                <button
                  type="button"
                  onClick={() => setModality("online")}
                  className={`flex-1 rounded-[10px] border px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                    modality === "online"
                      ? "border-[#0E9E82] bg-[#0E9E82] text-white"
                      : "border-[#E5E7EB] bg-white text-[#6B7280]"
                  }`}
                >
                  Online
                </button>
              </div>
            </div>
            {modality === "online" && canUseFeature(clinicPlan as Plan, "video_link") ? (
              <label className="block">
                <span className="text-sm font-medium text-foreground">Enlace de videollamada</span>
                <input
                  type="url"
                  value={videoLink}
                  onChange={(e) => setVideoLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="mt-1.5 w-full rounded-[10px] border-[1.5px] border-[#E5E7EB] px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-[#0E9E82]"
                />
                <p className="mt-1.5 text-xs text-[#9CA3AF]">
                  Al guardar se enviará el enlace al paciente por email automáticamente
                </p>
              </label>
            ) : modality === "online" && !canUseFeature(clinicPlan as Plan, "video_link") ? (
              <p className="text-xs text-[#9CA3AF]">
                Enlace de videollamada disponible en el plan Starter.{" "}
                <Link href={`${basePath}/mi-plan`} className="text-[#0E9E82] hover:underline">
                  Actualiza tu plan →
                </Link>
              </p>
            ) : null}
          </div>

          {patientError ? <p className="mt-3 text-sm text-red-600">{patientError}</p> : null}

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => void handleSavePatient()}
              disabled={savingPatient || !name.trim()}
              className="rounded-[10px] bg-[#0E9E82] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingPatient ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </section>

        {/* Sección 2: Reagendar cita (solo si onReschedule está disponible) */}
        {onReschedule ? (
          <section className="mt-6 border-t border-[#F3F4F6] pt-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6B7280]">
              Reagendar cita
            </h3>

            {!rescheduleAvailable ? (
              <p className="mt-3 text-sm text-muted">
                {isPastAppointment
                  ? "No se puede mover una cita ya pasada."
                  : "Esta cita no se puede reagendar por su estado actual."}
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Nueva fecha</span>
                  <input
                    type="date"
                    value={rescheduleDate}
                    min={getTodayInputValue()}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="mt-1.5 w-full rounded-[10px] border-[1.5px] border-[#E5E7EB] px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-[#0E9E82]"
                  />
                </label>

                <div>
                  <p className="text-sm font-medium text-foreground">Horarios disponibles</p>
                  <div className="mt-2">
                    {slotsLoading ? (
                      <p className="text-sm text-muted">Cargando disponibilidad...</p>
                    ) : slotsError ? (
                      <p className="text-sm text-red-600">{slotsError}</p>
                    ) : slots.length === 0 ? (
                      <p className="text-sm text-muted">
                        No hay huecos disponibles ese día. Prueba con otra fecha.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {slots.map((slot) => {
                          const isSelected = selectedSlot?.value === slot.value;
                          return (
                            <button
                              key={slot.value}
                              type="button"
                              onClick={() => setSelectedSlot(slot)}
                              className={`rounded-[10px] border px-4 py-2 text-sm font-medium transition-all duration-150 ${
                                isSelected
                                  ? "border-[#0E9E82] bg-[#0E9E82] text-white"
                                  : "border-[#E5E7EB] bg-white text-foreground hover:border-[#0E9E82] hover:bg-[#F0FDF9]"
                              }`}
                            >
                              {slot.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={notifyPatient}
                    onChange={(e) => setNotifyPatient(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[1.5px] border-[#E5E7EB] text-[#0E9E82] focus:ring-[#0E9E82]"
                  />
                  <span className="text-sm text-foreground">
                    Notificar al paciente del cambio por email
                  </span>
                </label>

                {rescheduleError ? (
                  <p className="text-sm text-red-600">{rescheduleError}</p>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleReschedule()}
                  disabled={rescheduling || !selectedSlot}
                  className="rounded-[10px] bg-[#0E9E82] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {rescheduling ? "Reagendando..." : "Reagendar cita"}
                </button>
              </div>
            )}
          </section>
        ) : null}

      </div>
    </div>
  );
}
