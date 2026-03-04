"use client";

import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import { getClinicTheme } from "@/lib/clinicTheme";
import { loadAppointment, updateAppointmentStatus } from "@/lib/storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

const SLOTS = [
  "Lunes · 16:30",
  "Lunes · 17:00",
  "Martes · 10:00",
  "Martes · 11:30",
  "Miércoles · 12:00",
  "Miércoles · 16:00",
];

type ReschedulePageProps = {
  params: {
    token: string;
  };
};

export default function ReschedulePage({ params }: ReschedulePageProps) {
  const token = params.token;
  const theme = getClinicTheme(token);
  const router = useRouter();
  const appointment = useMemo(() => loadAppointment(token), [token]);

  return (
    <div className="space-y-4">
      <HeaderBar
        logoText={theme.logoText}
        clinicName={theme.brandName}
        idLabel={appointment.idLabel}
        accentColor={theme.accent}
      />

      <AppointmentCard appointment={appointment} />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Selecciona un nuevo horario</h1>
        <p className="mt-2 text-sm text-gray-600">
          Al cambiar, tu cita anterior se libera automáticamente.
        </p>
        <div className="mt-4 space-y-2">
          {SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => {
                updateAppointmentStatus(token, "rescheduled", { datetimeLabel: slot });
                router.push(`/a/${token}/confirm`);
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 shadow-sm transition-all duration-150 hover:bg-gray-50 active:translate-y-[1px]"
            >
              {slot}
            </button>
          ))}
        </div>
      </section>

      <Link
        href={`/a/${token}`}
        className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all duration-150 hover:bg-gray-50 active:translate-y-[1px]"
      >
        Volver a la cita
      </Link>
    </div>
  );
}
