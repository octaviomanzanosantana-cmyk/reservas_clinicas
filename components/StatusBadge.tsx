import type { AppointmentStatus } from "@/lib/types";

type StatusBadgeProps = {
  status: AppointmentStatus;
};

const STATUS_META: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]" },
  confirmed: { label: "Confirmada", className: "bg-[var(--badge-confirmed-bg)] text-[var(--badge-confirmed-text)]" },
  change_requested: { label: "Cambio solicitado", className: "bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]" },
  cancelled: { label: "Cancelada", className: "bg-[var(--badge-cancelled-bg)] text-[var(--badge-cancelled-text)]" },
  completed: { label: "Asistió", className: "bg-[var(--badge-confirmed-bg)] text-[var(--badge-confirmed-text)]" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}
