"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type CreateClinicResponse = {
  clinic?: {
    slug: string;
  };
  error?: string;
};

export default function AdminNewClinicPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [themeColor, setThemeColor] = useState("#2563eb");
  const [description, setDescription] = useState("");
  const [seedDefaultServices, setSeedDefaultServices] = useState(true);
  const [seedDefaultHours, setSeedDefaultHours] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/clinics/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          slug,
          phone,
          address,
          theme_color: themeColor,
          description: description || null,
          seed_default_services: seedDefaultServices,
          seed_default_hours: seedDefaultHours,
        }),
      });

      const data = (await response.json()) as CreateClinicResponse;

      if (!response.ok || !data.clinic) {
        throw new Error(data.error ?? "No se pudo crear la clínica");
      }

      router.push(`/clinic/${data.clinic.slug}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear la clínica");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.98),_rgba(241,245,249,0.94)_38%,_rgba(226,232,240,0.86)_100%)] px-4 py-6 lg:px-6 lg:py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="rounded-[28px] border border-white/70 bg-white/90 p-7 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.38)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Admin interno
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                Nueva clínica
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Crea una clínica piloto y déjala preparada para panel, página pública, servicios y
                horarios base.
              </p>
            </div>

            <Link
              href="/admin/clinics"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-white hover:text-slate-900"
            >
              Volver al listado
            </Link>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.38)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Nombre</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-300"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Slug</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-300"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Teléfono</span>
                <input
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-300"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Color</span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(event) => setThemeColor(event.target.value)}
                    className="h-12 w-14 rounded-xl border border-slate-200 bg-white p-1"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={(event) => setThemeColor(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-300"
                  />
                </div>
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Dirección</span>
              <input
                type="text"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-300"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Descripción opcional</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-300"
              />
            </label>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
              <p className="text-sm font-medium text-slate-900">Preparación inicial</p>
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={seedDefaultServices}
                    onChange={(event) => setSeedDefaultServices(event.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-slate-700">Crear servicios base</span>
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={seedDefaultHours}
                    onChange={(event) => setSeedDefaultHours(event.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-slate-700">Crear horarios base</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-2xl border border-slate-900 bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_32px_-24px_rgba(15,23,42,0.8)] transition-all duration-150 hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creando..." : "Crear clínica"}
              </button>
              <Link
                href="/admin/clinics"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                Cancelar
              </Link>
            </div>

            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
          </form>
        </section>
      </div>
    </div>
  );
}
