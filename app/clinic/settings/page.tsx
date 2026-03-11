"use client";

import { useEffect, useState } from "react";

type ClinicResponse = {
  clinic?: {
    name: string;
    description: string | null;
    address: string | null;
    phone: string | null;
    logo_url: string | null;
    theme_color: string | null;
  };
  error?: string;
};

export default function ClinicSettingsPage() {
  const clinicSlug = "pilarcastillo";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [themeColor, setThemeColor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadClinic = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/api/clinics?slug=${clinicSlug}`);
        const data = (await response.json()) as ClinicResponse;

        if (!active) return;

        if (!response.ok || !data.clinic) {
          throw new Error(data.error ?? "No se pudo cargar la clínica");
        }

        setName(data.clinic.name ?? "");
        setDescription(data.clinic.description ?? "");
        setAddress(data.clinic.address ?? "");
        setPhone(data.clinic.phone ?? "");
        setLogoUrl(data.clinic.logo_url ?? "");
        setThemeColor(data.clinic.theme_color ?? "");
      } catch (error) {
        if (!active) return;
        setErrorMessage(error instanceof Error ? error.message : "No se pudo cargar la clínica");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadClinic();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/clinics/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: clinicSlug,
          name,
          description,
          address,
          phone,
          logo_url: logoUrl,
          theme_color: themeColor,
        }),
      });

      const data = (await response.json()) as ClinicResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo guardar la clínica");
      }

      setMessage("Guardado correctamente");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar la clínica");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Configuración de clínica
          </h1>
          <p className="mt-2 text-sm text-gray-600">Editar datos de {clinicSlug}</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {loading ? (
            <p className="text-sm text-gray-600">Cargando clínica...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Nombre clínica</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Descripción</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Dirección</span>
                <input
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Teléfono</span>
                <input
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Logo URL</span>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Color</span>
                <input
                  type="text"
                  value={themeColor}
                  onChange={(event) => setThemeColor(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
          )}

          {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
          {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}
        </section>
      </div>
    </div>
  );
}
