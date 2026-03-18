import StatusBadge from "@/components/StatusBadge";
import type { Appointment } from "@/lib/types";
import type { ReactNode } from "react";

type AppointmentCardProps = {
  appointment: Appointment;
};

function IconWrap({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-4 w-4 items-center justify-center text-gray-500">{children}</span>;
}

export default function AppointmentCard({ appointment }: AppointmentCardProps) {
  const [day = appointment.datetimeLabel, hour = ""] = appointment.datetimeLabel.split("·").map((v) => v.trim());

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-6">
      <div className="mb-5 flex items-start justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Tu cita</h1>
        <StatusBadge status={appointment.status} />
      </div>

      <p className="text-lg font-semibold text-slate-900">{appointment.clinicName}</p>
      <p className="mt-0.5 text-base text-slate-900">{appointment.service}</p>

      <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <IconWrap>
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18" />
          </svg>
        </IconWrap>
        <span>{day}</span>
        <span>·</span>
        <IconWrap>
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </IconWrap>
        <span>{hour}</span>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Paciente</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-900">
            <IconWrap>
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" />
                <path d="M5 20a7 7 0 0114 0" />
              </svg>
            </IconWrap>
            {appointment.patientName}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Dirección</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-900">
            <IconWrap>
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z" />
                <circle cx="12" cy="10" r="2.4" />
              </svg>
            </IconWrap>
            {appointment.address}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Duración</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-900">
            <IconWrap>
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </IconWrap>
            {appointment.durationLabel}
          </p>
        </div>
      </div>
    </section>
  );
}
