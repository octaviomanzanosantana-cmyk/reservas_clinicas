"use client";

import { canUseFeature } from "@/lib/plan";
import type { Plan } from "@/lib/plan";
import Link from "next/link";
import { useState } from "react";

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
};

type EditPatientModalProps = {
  appointment: EditableAppointment;
  clinicPlan: string;
  basePath: string;
  formatDate: (scheduledAt: string | null, fallback: string) => string;
  onSave: (data: {
    token: string;
    patient_name: string;
    patient_email: string | null;
    patient_phone: string | null;
    modality: string;
    video_link: string | null;
  }) => Promise<void>;
  onClose: () => void;
};

export function EditPatientModal({
  appointment,
  clinicPlan,
  basePath,
  formatDate,
  onSave,
  onClose,
}: EditPatientModalProps) {
  const [name, setName] = useState(appointment.patient_name);
  const [email, setEmail] = useState(appointment.patient_email ?? "");
  const [phone, setPhone] = useState(appointment.patient_phone ?? "");
  const [modality, setModality] = useState<"presencial" | "online">(
    appointment.modality === "online" ? "online" : "presencial",
  );
  const [videoLink, setVideoLink] = useState(appointment.video_link ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        token: appointment.token,
        patient_name: name.trim(),
        patient_email: email.trim() || null,
        patient_phone: phone.trim() || null,
        modality,
        video_link: modality === "online" ? (videoLink.trim() || null) : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-md rounded-[14px] border-[0.5px] border-[#E5E7EB] bg-white p-6 shadow-xl">
        <h2 className="font-heading text-lg font-semibold text-foreground">Editar cita</h2>
        <p className="mt-1 text-sm text-muted">
          {appointment.service} · {formatDate(appointment.scheduled_at, appointment.datetime_label)}
        </p>

        <div className="mt-5 space-y-4">
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
                onClick={() => { setModality("presencial"); setVideoLink(""); }}
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
              <p className="mt-1.5 text-xs text-[#9CA3AF]">Al guardar se enviará el enlace al paciente por email automáticamente</p>
            </label>
          ) : modality === "online" && !canUseFeature(clinicPlan as Plan, "video_link") ? (
            <p className="text-xs text-[#9CA3AF]">
              Enlace de videollamada disponible en el plan Starter.{" "}
              <Link href={`${basePath}/plan`} className="text-[#0E9E82] hover:underline">Actualiza tu plan →</Link>
            </p>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
            className="rounded-[10px] bg-[#0E9E82] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border-[0.5px] border-[#E5E7EB] px-5 py-2.5 text-sm font-semibold text-[#6B7280] transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
