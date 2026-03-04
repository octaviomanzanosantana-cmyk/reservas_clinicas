"use client";

import { getClinicTheme } from "@/lib/clinicTheme";
import { DEMO_TOKENS, getClinicConfig } from "@/lib/demoClinics";
import { loadAppointment } from "@/lib/storage";
import { useMemo, useState } from "react";

const VALOR_MEDIO_CITA = 80;

const MOCK_ACTIVITY: Array<{ patient: string; status: AgendaStatus; when: string }> = [
  { patient: "Marta García", status: "confirmada", when: "Hace 1 min" },
  { patient: "Carlos Martín", status: "cambio_solicitado", when: "Hace 4 min" },
  { patient: "Laura Pérez", status: "cancelada", when: "Hace 12 min" },
  { patient: "Ana Ruiz", status: "confirmada", when: "Hace 18 min" },
];

type AgendaStatus = "confirmada" | "cambio_solicitado" | "cancelada";

const STATUS_LABEL: Record<AgendaStatus, string> = {
  confirmada: "Confirmada",
  cambio_solicitado: "Cambio solicitado",
  cancelada: "Cancelada",
};

export default function DemoDashboardPage() {
  const [token, setToken] = useState("demo123");
  const appointmentStatus = useMemo(() => loadAppointment(token).status, [token]);
  const clinic = getClinicConfig(token);
  const theme = getClinicTheme(token);

  const liveStatus: AgendaStatus | null = useMemo(() => {
    if (appointmentStatus === "confirmed") return "confirmada";
    if (appointmentStatus === "rescheduled") return "cambio_solicitado";
    if (appointmentStatus === "cancelled") return "cancelada";
    return null;
  }, [appointmentStatus]);

  const impactMetrics = useMemo(() => {
    const pool = [...MOCK_ACTIVITY];
    if (liveStatus) {
      pool.unshift({ patient: "Paciente demo", status: liveStatus, when: "Hace unos segundos" });
    }

    const confirmadas = pool.filter((item) => item.status === "confirmada").length;
    const cambios = pool.filter((item) => item.status === "cambio_solicitado").length;
    const canceladas = pool.filter((item) => item.status === "cancelada").length;
    const llamadasEvitadas = confirmadas + cambios + canceladas;

    const huecosRecuperables = canceladas;
    const ingresosProtegidos = huecosRecuperables * VALOR_MEDIO_CITA;

    return {
      confirmadas,
      cambios,
      canceladas,
      llamadasEvitadas,
      huecosRecuperables,
      ingresosProtegidos,
      activity: pool,
    };
  }, [liveStatus]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold shadow-sm"
            style={{ backgroundColor: `${theme.accent}1f`, color: theme.accent }}
          >
            {theme.logoText}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Panel de clínica (demo)</h1>
            <p className="mt-1 text-sm text-gray-600">Vista demo para clínicas</p>
          </div>
        </header>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium text-gray-700" htmlFor="token">
            Token de demo
          </label>
          <select
            id="token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            {DEMO_TOKENS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-gray-600">
            Clínica seleccionada: <span className="font-medium text-gray-900">{clinic.clinicName}</span>
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Impacto en la agenda</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Confirmaciones sin llamada" value={impactMetrics.confirmadas} accent={theme.accent} />
            <MetricCard label="Cambios solicitados" value={impactMetrics.cambios} accent={theme.accent} />
            <MetricCard label="Cancelaciones anticipadas" value={impactMetrics.canceladas} accent={theme.accent} />
            <MetricCard label="Llamadas evitadas (estimación)" value={impactMetrics.llamadasEvitadas} accent={theme.accent} />
          </div>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Impacto económico estimado</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MetricCard label="Huecos recuperables" value={impactMetrics.huecosRecuperables} accent={theme.accent} />
            <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ingresos protegidos estimados</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
                {impactMetrics.ingresosProtegidos}€
              </p>
              <div className="mt-3 h-1.5 rounded-full" style={{ backgroundColor: `${theme.accent}33` }} />
            </article>
          </div>
        </section>

        <p className="mb-6 text-sm text-gray-600">
          Actividad generada desde enlaces enviados a pacientes.
        </p>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Actividad reciente</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="px-2 py-2 font-medium">Paciente</th>
                  <th className="px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2 font-medium">Actualización</th>
                </tr>
              </thead>
              <tbody>
                {impactMetrics.activity.map((row) => (
                  <tr key={`${row.patient}-${row.when}`} className="border-b border-gray-100">
                    <td className="px-2 py-2 text-gray-900">{row.patient}</td>
                    <td className="px-2 py-2 text-gray-700">{STATUS_LABEL[row.status]}</td>
                    <td className="px-2 py-2 text-gray-600">{row.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Demo rápida</h2>
          <p className="mt-2 text-sm text-gray-600">
            Abre el flujo del paciente con el token seleccionado.
          </p>
          <button
            type="button"
            onClick={() => window.open(`/a/${token}`, "_blank", "noopener,noreferrer")}
            className="mt-4 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-95 active:translate-y-[1px]"
            style={{ backgroundColor: theme.primary }}
          >
            Abrir enlace paciente
          </button>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{value}</p>
      <div className="mt-3 h-1.5 rounded-full" style={{ backgroundColor: `${accent}33` }} />
    </article>
  );
}
