import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.18),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)] px-4">
      <div className="mx-auto max-w-5xl py-16 md:py-24">
        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/92 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.45)]">
          <div className="px-6 py-10 md:px-10 md:py-12">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Entorno operativo
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 md:text-[3.25rem]">
              Reservas para clinicas privadas
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
              Aplicacion de gestion de citas para panel interno, reservas publicas y enlaces de
              paciente.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Link
                href="/admin/clinics"
                className="rounded-[24px] border border-slate-900 bg-slate-900 px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_34px_-24px_rgba(15,23,42,0.75)] transition-all duration-150 hover:bg-black"
              >
                Administrar clinicas
              </Link>
              <Link
                href={`/clinic/${PANEL_CLINIC_SLUG}`}
                className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold text-slate-900 transition-all duration-150 hover:border-slate-300 hover:bg-white"
              >
                Abrir panel activo
              </Link>
              <Link
                href={`/b/${PANEL_CLINIC_SLUG}`}
                className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50"
              >
                Ver reserva publica
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.38)]">
            <p className="text-sm font-medium text-slate-900">Panel clinica</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Gestion diaria de agenda, servicios, horarios y estado de citas.
            </p>
          </article>
          <article className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.38)]">
            <p className="text-sm font-medium text-slate-900">Reserva publica</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Pagina abierta de reserva con disponibilidad real y validacion de huecos.
            </p>
          </article>
          <article className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.38)]">
            <p className="text-sm font-medium text-slate-900">Enlace paciente</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Confirmacion, cancelacion y reprogramacion desde un enlace unico.
            </p>
          </article>
        </section>

        <section className="mt-8 rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-600">
          <p>
            Ruta canonica del panel: <span className="font-medium text-slate-900">/clinic/[slug]</span>
          </p>
          <p className="mt-2">
            Acceso activo configurado: <span className="font-medium text-slate-900">{PANEL_CLINIC_SLUG}</span>
          </p>
        </section>
      </div>
    </main>
  );
}
