"use client";

import AppointmentCard from "@/components/AppointmentCard";
import HeaderBar from "@/components/HeaderBar";
import Toast from "@/components/Toast";
import { getClinicTheme } from "@/lib/clinicTheme";
import { getClinicConfig } from "@/lib/demoClinics";
import { darkenHex } from "@/lib/color";
import { updateAppointmentStatus } from "@/lib/storage";
import Link from "next/link";
import { useMemo, useState } from "react";

type ConfirmPageProps = {
  params: {
    token: string;
  };
};

export default function ConfirmPage({ params }: ConfirmPageProps) {
  const token = params.token;
  const clinic = getClinicConfig(token);
  const theme = getClinicTheme(token);
  const appointment = useMemo(() => updateAppointmentStatus(token, "confirmed"), [token]);
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
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-center text-xl font-semibold tracking-tight text-gray-900">Cita confirmada</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          La clínica ha recibido tu confirmación. Te esperamos {appointment.datetimeLabel}.
        </p>
      </section>

      <AppointmentCard appointment={appointment} />

      <Link
        href={`/a/${token}`}
        className="inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-95 active:translate-y-[1px]"
        style={{ backgroundColor: theme.primary }}
        onMouseDown={(event) => {
          event.currentTarget.style.backgroundColor = darkenHex(theme.primary, 18);
        }}
        onMouseUp={(event) => {
          event.currentTarget.style.backgroundColor = theme.primary;
        }}
      >
        Volver a la cita
      </Link>

      <Toast
        message="Acción realizada. La clínica ha sido notificada."
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
      <p className="text-xs text-center text-gray-500">Soporte: {clinic.supportPhone}</p>
    </div>
  );
}
