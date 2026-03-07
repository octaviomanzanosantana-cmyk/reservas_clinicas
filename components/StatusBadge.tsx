import type { AppointmentStatus } from "@/lib/types";

type StatusBadgeProps = {
  status: AppointmentStatus;
};

const STATUS_META: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-50 text-amber-700 border border-amber-200" },
  confirmed: { label: "Confirmada", className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  change_requested: { label: "Cambio solicitado", className: "bg-blue-50 text-blue-700 border border-blue-200" },
  cancelled: { label: "Cancelada", className: "bg-red-50 text-red-700 border border-red-200" },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}
