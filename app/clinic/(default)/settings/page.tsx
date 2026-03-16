"use client";

import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import {
  isGoogleCalendarConnected,
  type GoogleCalendarStatus,
} from "@/lib/googleCalendarStatus";
import { useEffect, useState } from "react";

type ClinicResponse = {
  clinic?: {
    id?: string;
    slug?: string;
    name: string;
    description: string | null;
    address: string | null;
    phone: string | null;
    logo_url: string | null;
    theme_color: string | null;
    booking_enabled?: boolean;
  };
  error?: string;
};

type ClinicSettingsPageProps = {
  clinicSlug?: string;
};

export function ClinicSettingsPage({ clinicSlug = PANEL_CLINIC_SLUG }: ClinicSettingsPageProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [themeColor, setThemeColor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadClinic = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [clinicResponse, googleResponse] = await Promise.all([
          fetch(`/api/clinics?slug=${encodeURIComponent(clinicSlug)}`),
          fetch(`/api/google/status?clinicSlug=${encodeURIComponent(clinicSlug)}`),
        ]);
        const clinicData = (await clinicResponse.json()) as ClinicResponse;
        const googleData = (await googleResponse.json()) as GoogleCalendarStatus;

        if (!active) return;

        if (!clinicResponse.ok || !clinicData.clinic) {
          throw new Error(clinicData.error ?? "No se pudo cargar la clínica");
        }

        if (!googleResponse.ok) {
          throw new Error(googleData.error ?? "No se pudo cargar Google Calendar");
        }

        setName(clinicData.clinic.name ?? "");
        setDescription(clinicData.clinic.description ?? "");
        setAddress(clinicData.clinic.address ?? "");
        setPhone(clinicData.clinic.phone ?? "");
        setLogoUrl(clinicData.clinic.logo_url ?? "");
        setThemeColor(clinicData.clinic.theme_color ?? "");
        setGoogleConnected(isGoogleCalendarConnected(googleData));
        setGoogleEmail(googleData.email ?? null);
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
  }, [clinicSlug]);

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

  const handleDisconnectGoogle = async () => {
    setDisconnectingGoogle(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/google/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clinicSlug }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo desconectar Google Calendar");
      }

      setGoogleConnected(false);
      setGoogleEmail(null);
      setMessage("Google Calendar desconectado");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo desconectar Google Calendar",
      );
    } finally {
      setDisconnectingGoogle(false);
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
                <span className="text-sm font-medium text-gray-700">
                  Teléfono de contacto de la clínica
                </span>
                <input
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Este número se mostrará a los pacientes en sus páginas de cita y reserva.
                </p>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Logo URL</span>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Pega una URL pública de imagen para mostrar el logo en la página de reservas.
                </p>
                {logoUrl ? (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-slate-50 p-3">
                    <img src={logoUrl} alt="Preview logo" className="h-16 object-contain" />
                  </div>
                ) : null}
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Color</span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="color"
                    value={themeColor || "#2563eb"}
                    onChange={(event) => setThemeColor(event.target.value)}
                    className="h-11 w-14 rounded-lg border border-gray-300 bg-white p-1"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={(event) => setThemeColor(event.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  />
                </div>
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

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Google Calendar</h2>
              <p className="mt-2 text-sm text-gray-600">
                {googleConnected
                  ? `Conectado${googleEmail ? ` como ${googleEmail}` : ""}.`
                  : "No conectado."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {!googleConnected ? (
                <a
                  href={`/api/google/connect?clinicSlug=${encodeURIComponent(clinicSlug)}`}
                  className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-black"
                >
                  Conectar Google Calendar
                </a>
              ) : null}

              {googleConnected ? (
                <button
                  type="button"
                  onClick={() => void handleDisconnectGoogle()}
                  disabled={disconnectingGoogle}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-all duration-150 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {disconnectingGoogle ? "Desconectando..." : "Desconectar"}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ClinicSettingsRoute() {
  return <ClinicSettingsPage />;
}
