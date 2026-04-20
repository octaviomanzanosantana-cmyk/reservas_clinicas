"use client";

import { buildAppointmentShareMessage } from "@/lib/appointmentShareMessage";
import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { useCallback, useEffect, useMemo, useState } from "react";

type TomorrowAppointment = {
  id: number;
  token: string;
  patient_name: string;
  patient_phone: string | null;
  service_name: string;
  modality: "presencial" | "online";
  appointment_type: string | null;
  scheduled_at: string;
  video_link: string | null;
  whatsapp_reminder_sent_at: string | null;
};

type ClinicRemindersPageProps = {
  clinicSlug?: string;
};

type ClinicSummary = {
  name: string;
  address: string | null;
  timezone: string;
};

type TabKey = "today" | "tomorrow" | "dayAfter";

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function toLocalDateKey(iso: string): string {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayLocalKey(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

function formatDateLabel(scheduledAt: string): string {
  const date = new Date(scheduledAt);
  const wd = date.toLocaleDateString("es-ES", { weekday: "long" });
  const monthName = date.toLocaleDateString("es-ES", { month: "long" });
  const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
  return `${cap(wd)} ${date.getDate()} de ${monthName} a las ${formatTime(scheduledAt)}`;
}

function buildDefaultMessage(params: {
  patientName: string;
  clinicName: string;
  clinicAddress: string | null;
  serviceName: string;
  scheduledAt: string;
  modality: "presencial" | "online";
  videoLink: string | null;
  appointmentToken: string;
  appUrl: string;
}): string {
  return buildAppointmentShareMessage({
    kind: "reminder",
    patientName: params.patientName,
    clinicName: params.clinicName,
    serviceName: params.serviceName,
    dateLabel: formatDateLabel(params.scheduledAt),
    address: params.clinicAddress,
    modality: params.modality,
    videoLink: params.videoLink,
    appointmentToken: params.appointmentToken,
    appUrl: params.appUrl,
  });
}

function buildWaLink(phone: string, message: string): string {
  let raw = phone.replace(/[\s\-().]/g, "");
  if (!raw.startsWith("+")) raw = `+34${raw}`;
  const digits = raw.replace(/[^\d]/g, "");
  // api.whatsapp.com/send (NO wa.me): evita redirect que corrompe emojis 4B.
  return `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`;
}

export function ClinicRemindersPage({ clinicSlug = PANEL_CLINIC_SLUG }: ClinicRemindersPageProps) {
  const [clinic, setClinic] = useState<ClinicSummary>({
    name: "",
    address: null,
    timezone: "Atlantic/Canary",
  });
  const [reminders, setReminders] = useState<TomorrowAppointment[]>([]);
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<TabKey>("tomorrow");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [clinicRes, remindersRes] = await Promise.all([
        fetch(`/api/clinics?slug=${encodeURIComponent(clinicSlug)}`),
        fetch(`/api/clinic-reminders?clinicSlug=${encodeURIComponent(clinicSlug)}`),
      ]);
      const clinicData = (await clinicRes.json()) as {
        clinic?: { name?: string; address?: string | null; timezone?: string };
        error?: string;
      };
      const remindersData = (await remindersRes.json()) as {
        reminders?: TomorrowAppointment[];
        error?: string;
      };
      if (!clinicRes.ok) throw new Error(clinicData.error ?? "No se pudo cargar la clínica");
      if (!remindersRes.ok) throw new Error(remindersData.error ?? "No se pudieron cargar los recordatorios");
      setClinic({
        name: clinicData.clinic?.name ?? "",
        address: clinicData.clinic?.address ?? null,
        timezone: clinicData.clinic?.timezone ?? "Atlantic/Canary",
      });
      setReminders(remindersData.reminders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    }
  }, [clinicSlug]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await load();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  // Inicializa mensajes por defecto una vez que tenemos clinic + reminders
  useEffect(() => {
    if (!clinic.name) return;
    setMessages((prev) => {
      const next = { ...prev };
      for (const r of reminders) {
        if (!(r.id in next)) {
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL?.trim() ||
            (typeof window !== "undefined" ? window.location.origin : "https://app.appoclick.com");
          next[r.id] = buildDefaultMessage({
            patientName: r.patient_name,
            clinicName: clinic.name,
            clinicAddress: clinic.address,
            serviceName: r.service_name,
            scheduledAt: r.scheduled_at,
            modality: r.modality,
            videoLink: r.video_link,
            appointmentToken: r.token,
            appUrl: baseUrl,
          });
        }
      }
      return next;
    });
  }, [reminders, clinic.name]);

  const grouped = useMemo(() => {
    const today = todayLocalKey(0);
    const tomorrow = todayLocalKey(1);
    const dayAfter = todayLocalKey(2);
    const buckets: Record<TabKey, TomorrowAppointment[]> = {
      today: [],
      tomorrow: [],
      dayAfter: [],
    };
    for (const r of reminders) {
      const key = toLocalDateKey(r.scheduled_at);
      if (key === today) buckets.today.push(r);
      else if (key === tomorrow) buckets.tomorrow.push(r);
      else if (key === dayAfter) buckets.dayAfter.push(r);
    }
    return buckets;
  }, [reminders]);

  const activeList = grouped[activeTab];

  async function persistMark(appointmentId: number, sent: boolean) {
    try {
      const res = await fetch("/api/clinic-reminders/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicSlug, appointmentId, sent }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Error al marcar");
      }
      setReminders((prev) =>
        prev.map((r) =>
          r.id === appointmentId
            ? { ...r, whatsapp_reminder_sent_at: sent ? new Date().toISOString() : null }
            : r,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al marcar");
    }
  }

  function openWhatsAppFor(r: TomorrowAppointment) {
    const msg = messages[r.id] ?? "";
    const url = buildWaLink(r.patient_phone ?? "", msg);
    window.open(url, "_blank", "noopener,noreferrer");
    if (!r.whatsapp_reminder_sent_at) {
      void persistMark(r.id, true);
    }
  }

  async function openAll() {
    const pending = activeList.filter((r) => !r.whatsapp_reminder_sent_at);
    if (pending.length === 0) return;
    const confirmed = window.confirm(
      `Se abrirán ${pending.length} pestañas de WhatsApp. Revisa y envía cada mensaje.`,
    );
    if (!confirmed) return;

    setBulkProgress({ current: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      const r = pending[i];
      setBulkProgress({ current: i + 1, total: pending.length });
      openWhatsAppFor(r);
      if (i < pending.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    setBulkProgress(null);
  }

  function renderCard(r: TomorrowAppointment) {
    const sent = Boolean(r.whatsapp_reminder_sent_at);
    const msg = messages[r.id] ?? "";

    return (
      <article
        key={r.id}
        className={`rounded-[14px] border-[0.5px] border-border bg-card p-5 transition-opacity ${sent ? "opacity-60" : ""}`}
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-heading text-base font-semibold text-foreground">
            {formatTime(r.scheduled_at)} · {r.patient_name}
          </span>
          <span className="text-sm text-muted">· {r.patient_phone ?? "Sin teléfono"}</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {r.service_name} · {r.modality === "online" ? "Online" : "Presencial"}
          {r.appointment_type === "primera_visita"
            ? " · Primera visita"
            : r.appointment_type === "revision"
              ? " · Revisión"
              : ""}
        </p>

        <div className="mt-4">
          <label className="block text-sm font-medium text-foreground">Mensaje</label>
          <textarea
            value={msg}
            onChange={(e) => setMessages((prev) => ({ ...prev, [r.id]: e.target.value }))}
            rows={4}
            className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => openWhatsAppFor(r)}
            className={`rounded-[10px] px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 ${
              sent
                ? "bg-muted hover:opacity-90"
                : "bg-[#25D366] hover:opacity-90"
            }`}
          >
            {sent ? "Volver a enviar" : "Enviar por WhatsApp"}
          </button>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={sent}
              onChange={(e) => void persistMark(r.id, e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Marcado como enviado
          </label>
        </div>
      </article>
    );
  }

  const tabs: { key: TabKey; label: string; offset: number }[] = [
    { key: "today", label: "Hoy", offset: 0 },
    { key: "tomorrow", label: "Mañana", offset: 1 },
    { key: "dayAfter", label: "Pasado mañana", offset: 2 },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          Recordatorios
        </h1>
        <p className="mt-2 text-sm text-muted">
          Envía recordatorios por WhatsApp a las próximas citas.
        </p>
      </section>

      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
        <div className="flex flex-wrap gap-2 border-b border-border pb-3">
          {tabs.map((t) => {
            const count = grouped[t.key].length;
            const label = `${t.label}: ${count} ${count === 1 ? "cita" : "citas"}`;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className={`rounded-[10px] px-4 py-2 font-heading text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-primary text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void openAll()}
            disabled={
              bulkProgress !== null ||
              activeList.filter((r) => !r.whatsapp_reminder_sent_at).length === 0
            }
            className="rounded-[10px] bg-[#25D366] px-5 py-2.5 font-heading text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkProgress
              ? `Abriendo ${bulkProgress.current} de ${bulkProgress.total}...`
              : "Abrir todas las pestañas de WhatsApp"}
          </button>
          <p className="text-xs text-muted">
            Se abren las de <strong>{formatDayLabel(todayLocalKey(tabs.find((t) => t.key === activeTab)?.offset ?? 1))}</strong> que no estén marcadas, con un pequeño retraso entre cada una.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <p className="text-sm text-muted">Cargando...</p>
          ) : activeList.length === 0 ? (
            <p className="text-sm text-muted">
              No hay citas con teléfono para este día. Los pacientes sin teléfono no aparecen aquí.
            </p>
          ) : (
            activeList.map(renderCard)
          )}
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </section>
    </div>
  );
}
