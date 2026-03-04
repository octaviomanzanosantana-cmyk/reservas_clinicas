"use client";

import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import Toast from "@/components/Toast";
import { getClinicTheme } from "@/lib/clinicTheme";
import { updateAppointmentStatus } from "@/lib/storage";
import Link from "next/link";
import { useMemo, useState } from "react";

type CancelPageProps = {
  params: {
    token: string;
  };
};

export default function CancelPage({ params }: CancelPageProps) {
  const token = params.token;
  const theme = getClinicTheme(token);
  const appointment = useMemo(() => updateAppointmentStatus(token, "cancelled"), [token]);
  const [toastVisible, setToastVisible] = useState(true);

  return (
    <div className="space-y-4">
      <HeaderBar
        logoText={theme.logoText}
        clinicName={theme.brandName}
        idLabel={appointment.idLabel}
        accentColor={theme.accent}
      />

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
            <path d="M12 8v5" strokeLinecap="round" />
            <path d="M12 16h.01" strokeLinecap="round" />
            <path d="M10.3 3.2L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.2a2 2 0 00-3.4 0z" />
          </svg>
        </div>
        <h1 className="text-center text-xl font-semibold tracking-tight text-gray-900">Cita cancelada</h1>
        <p className="mt-2 text-center text-sm text-gray-600">La clínica ha recibido la cancelación.</p>
      </section>

      <AppointmentCard appointment={appointment} />

      <Link
        href={`/a/${token}`}
        className="inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-95 active:translate-y-[1px]"
        style={{ backgroundColor: theme.primary }}
      >
        Volver a la cita
      </Link>

      <Toast
        message="Acción realizada. La clínica ha sido notificada."
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
    </div>
  );
}
