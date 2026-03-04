"use client";

import ActionPanel from "@/components/ActionPanel";
import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import { getClinicTheme } from "@/lib/clinicTheme";
import { getClinicConfig } from "@/lib/demoClinics";
import { loadAppointment, updateAppointmentStatus } from "@/lib/storage";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

type AppointmentHomeProps = {
  params: {
    token: string;
  };
};

export default function AppointmentHomePage({ params }: AppointmentHomeProps) {
  const router = useRouter();
  const token = params.token;
  const clinic = getClinicConfig(token);
  const theme = getClinicTheme(token);
  const appointment = useMemo(() => loadAppointment(token), [token]);

  return (
    <div className="space-y-6">
      <HeaderBar
        logoText={theme.logoText}
        clinicName={theme.brandName}
        idLabel={appointment.idLabel}
        accentColor={theme.accent}
      />

      <span
        className="inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium"
        style={{ backgroundColor: `${theme.accent}1f`, color: theme.accent }}
      >
        Enlace seguro de autoservicio
      </span>

      <p className="text-xs text-gray-500">Tu cita es en 2 días</p>

      {appointment.status === "confirmed" || appointment.status === "rescheduled" ? (
        <p className="text-sm font-medium text-emerald-600">✔ Cita confirmada correctamente</p>
      ) : null}

      <AppointmentCard appointment={appointment} />

      <ActionPanel
        primaryColor={theme.primary}
        accentColor={theme.accent}
        onConfirm={() => {
          updateAppointmentStatus(token, "confirmed");
          router.push(`/a/${token}/confirm`);
        }}
        onReschedule={() => {
          router.push(`/a/${token}/reschedule`);
        }}
        onCancel={() => {
          updateAppointmentStatus(token, "cancelled");
          router.push(`/a/${token}/cancel`);
        }}
      />

      <footer className="pb-4 text-center text-xs text-gray-600">
        <p className="font-medium text-gray-700">No compartas este enlace</p>
        <p className="mt-1">Soporte: {clinic.supportPhone}</p>
      </footer>
    </div>
  );
}
