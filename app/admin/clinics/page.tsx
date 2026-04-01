import { listClinics } from "@/lib/clinics";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminClinicsPage() {
  const clinics = await listClinics();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(241,245,249,0.94)_38%,_rgba(226,232,240,0.86)_100%)] px-4 py-6 lg:px-6 lg:py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[28px] border border-white/70 bg-white/90 p-7 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.38)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Admin interno
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                Clínicas
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Gestiona las clínicas piloto y abre rápidamente su panel o página pública.
              </p>
            </div>

            <Link
              href="/admin/clinics/new"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_32px_-24px_rgba(15,23,42,0.8)] transition-all duration-150 hover:bg-black"
            >
              Nueva clínica
            </Link>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.38)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Listado de clínicas
              </h2>
              <p className="mt-1 text-sm text-slate-500">{clinics.length} cargadas</p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200 bg-slate-50/70">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Slug</th>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {clinics.map((clinic) => (
                  <tr key={clinic.id} className="text-slate-700 transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{clinic.name}</td>
                    <td className="px-4 py-3">{clinic.slug}</td>
                    <td className="px-4 py-3">{clinic.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/clinic/${clinic.slug}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-white hover:text-slate-900"
                        >
                          Abrir panel
                        </Link>
                        <Link
                          href={`/b/${clinic.slug}`}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                        >
                          Página pública
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {clinics.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-600">No hay clínicas creadas todavía.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
