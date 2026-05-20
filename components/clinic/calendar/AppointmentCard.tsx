"use client";

import { formatTimeLabel } from "@/lib/availability";
import type { AppointmentRow } from "@/lib/calendar/useCalendarData";

export type AppointmentCardVariant = "regular" | "compact" | "mini";

type StatusMeta = {
  label: string;
  className: string;
  accentClassName: string;
};

const STATUS_META: Record<string, StatusMeta> = {
  pending: {
    label: "Pendiente",
    className: "bg-amber-100 text-amber-700",
    accentClassName: "bg-amber-400",
  },
  confirmed: {
    label: "Confirmada",
    className: "bg-emerald-100 text-emerald-700",
    accentClassName: "bg-emerald-500",
  },
  cancelled: {
    label: "Cancelada",
    className: "bg-red-100 text-red-700",
    accentClassName: "bg-red-500",
  },
  completed: {
    label: "Asistió",
    className: "bg-slate-100 text-slate-700",
    accentClassName: "bg-slate-400",
  },
  change_requested: {
    label: "Cambio solicitado",
    className: "bg-blue-100 text-blue-700",
    accentClassName: "bg-blue-500",
  },
};

export function getStatusMeta(status: string): StatusMeta {
  return (
    STATUS_META[status] ?? {
      label: status,
      className: "bg-slate-100 text-slate-700",
      accentClassName: "bg-slate-400",
    }
  );
}

type AppointmentCardProps = {
  appointment: AppointmentRow;
  variant: AppointmentCardVariant;
  onClick: (appointment: AppointmentRow) => void;
};

function buildTitle(appointment: AppointmentRow, statusMeta: StatusMeta): string {
  return `Paciente: ${appointment.patient_name}\nServicio: ${appointment.service}\nModalidad: ${appointment.modality === "online" ? "Online" : "Presencial"}\nTeléfono: ${appointment.patient_phone?.trim() || "—"}\nEstado: ${statusMeta.label}`;
}

export function AppointmentCard({ appointment, variant, onClick }: AppointmentCardProps) {
  const statusMeta = getStatusMeta(appointment.status);
  const title = buildTitle(appointment, statusMeta);

  if (variant === "mini") {
    const hhmm = appointment.scheduled_at
      ? formatTimeLabel(new Date(appointment.scheduled_at))
      : "";
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick(appointment);
        }}
        title={title}
        className="flex w-full items-center gap-1 overflow-hidden rounded px-1.5 py-0.5 text-left text-[11px] leading-tight transition-colors hover:bg-slate-100"
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusMeta.accentClassName}`}
        />
        {hhmm ? (
          <span className="shrink-0 font-medium text-slate-600">{hhmm}</span>
        ) : null}
        <span className="truncate text-slate-900">{appointment.patient_name}</span>
      </button>
    );
  }

  if (variant === "regular") {
    return (
      <button
        type="button"
        onClick={() => onClick(appointment)}
        title={title}
        className="flex w-full text-left rounded-[22px] border border-slate-200 bg-white shadow-[0_16px_32px_-26px_rgba(15,23,42,0.45)] transition-all duration-150 hover:border-slate-300 hover:bg-slate-50"
      >
        <div
          className={`w-1.5 shrink-0 rounded-l-[22px] ${statusMeta.accentClassName}`}
        />
        <div className="min-w-0 p-4">
          <p className="text-sm font-semibold text-slate-900">
            {appointment.patient_name}
          </p>
          <p className="mt-1 text-sm text-slate-600">{appointment.service}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {appointment.modality === "online" ? "Online" : "Presencial"}
            {" · "}
            {appointment.appointment_type === "revision" ? "Revisión" : "1ª Cita"}
          </p>
          <span
            className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}
          >
            {statusMeta.label}
          </span>
        </div>
      </button>
    );
  }

  // compact + mini: misma render por ahora. MonthView (paso 6) ajustará "mini".
  return (
    <button
      type="button"
      onClick={() => onClick(appointment)}
      title={title}
      className="flex w-full min-w-0 max-w-full overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50 text-left shadow-[0_14px_28px_-24px_rgba(15,23,42,0.45)] transition-all duration-150 hover:border-slate-300 hover:bg-white"
    >
      <div
        className={`w-1 shrink-0 rounded-l-[20px] ${statusMeta.accentClassName}`}
      />
      <div className="min-w-0 flex-1 p-2.5">
        <p className="truncate text-xs font-semibold text-slate-900">
          {appointment.patient_name}
        </p>
        <p className="mt-1 truncate text-xs text-slate-600">
          {appointment.service}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
          {appointment.modality === "online" ? "Online" : "Presencial"} ·{" "}
          {appointment.appointment_type === "revision" ? "Rev." : "1ª"}
        </p>
        <span
          className={`mt-2 inline-flex max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}
        >
          {statusMeta.label}
        </span>
      </div>
    </button>
  );
}
