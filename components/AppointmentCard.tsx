import StatusBadge from "@/components/StatusBadge";
import type { Appointment } from "@/lib/types";
import type { ReactNode } from "react";

type AppointmentCardProps = {
  appointment: Appointment;
};

function IconWrap({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-4 w-4 items-center justify-center text-muted">{children}</span>;
}

export default function AppointmentCard({ appointment }: AppointmentCardProps) {
  const [day = appointment.datetimeLabel, hour = ""] = appointment.datetimeLabel.split("·").map((v) => v.trim());

  return (
    <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
      <div className="mb-5 flex items-start justify-between gap-2">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">Tu cita</h1>
        <StatusBadge status={appointment.status} />
      </div>

      <p className="font-heading text-lg font-semibold text-foreground">{appointment.clinicName}</p>
      <p className="mt-0.5 text-base text-foreground">{appointment.service}</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {appointment.appointmentType ? (
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary">
            {appointment.appointmentType === "revision" ? "Revision" : "Primera visita"}
          </span>
        ) : null}
        {appointment.modality ? (
          <span className="rounded-full bg-background px-2.5 py-0.5 text-xs font-medium text-muted">
            {appointment.modality === "online" ? "Online" : "Presencial"}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-muted">
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
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Paciente</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-foreground">
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
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Direccion</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-foreground">
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
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Duracion</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-foreground">
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
