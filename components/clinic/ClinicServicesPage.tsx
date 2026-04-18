"use client";

import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { useEffect, useState } from "react";

type ServiceRow = {
  id: string;
  clinic_slug: string;
  name: string;
  duration_minutes: number;
  active: boolean;
};

type ServicesResponse = {
  services?: ServiceRow[];
  error?: string;
};

type ServiceMutationResponse = {
  service?: ServiceRow;
  error?: string;
};

type ClinicServicesPageProps = {
  clinicSlug?: string;
};

export function ClinicServicesPage({ clinicSlug = PANEL_CLINIC_SLUG }: ClinicServicesPageProps) {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newServiceName, setNewServiceName] = useState("");
  const [newDurationMinutes, setNewDurationMinutes] = useState("30");

  const loadServices = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/services?clinicSlug=${clinicSlug}`);
      const data = (await response.json()) as ServicesResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudieron cargar los servicios");
      }

      setServices(data.services ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los servicios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadServices();
  }, []);

  const handleServiceChange = (
    id: string,
    field: "name" | "duration_minutes" | "active",
    value: string | number | boolean,
  ) => {
    setServices((current) =>
      current.map((service) =>
        service.id === id
          ? {
              ...service,
              [field]: value,
            }
          : service,
      ),
    );
  };

  const handleSave = async (service: ServiceRow) => {
    setSavingId(service.id);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/services/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: service.id,
          name: service.name,
          duration_minutes: service.duration_minutes,
          active: service.active,
        }),
      });

      const data = (await response.json()) as ServiceMutationResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo guardar el servicio");
      }

      await loadServices();
      setMessage("Guardado correctamente");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar el servicio");
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const durationMinutes = Number(newDurationMinutes);
      const response = await fetch("/api/services/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clinic_slug: clinicSlug,
          name: newServiceName,
          duration_minutes: durationMinutes,
          active: true,
        }),
      });

      const data = (await response.json()) as ServiceMutationResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo crear el servicio");
      }

      setNewServiceName("");
      setNewDurationMinutes("30");
      await loadServices();
      setMessage("Servicio añadido correctamente");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear el servicio");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Servicios de la clínica
          </h1>
          <p className="mt-2 text-sm text-gray-600">Gestiona los servicios de {clinicSlug}</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Añadir servicio</h2>
          <form onSubmit={handleCreate} className="mt-4 grid gap-4 md:grid-cols-[1fr_180px_auto]">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Nombre</span>
              <input
                type="text"
                value={newServiceName}
                onChange={(event) => setNewServiceName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">Duración en minutos</span>
              <input
                type="number"
                min={1}
                value={newDurationMinutes}
                onChange={(event) => setNewDurationMinutes(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </label>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ? "Añadiendo..." : "Añadir servicio"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Servicios existentes</h2>
            {loading ? <p className="text-sm text-gray-500">Cargando...</p> : null}
          </div>

          <div className="mt-4 space-y-4">
            {services.map((service) => (
              <article
                key={service.id}
                className="rounded-2xl border border-gray-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-gray-900">{service.name}</p>
                    <p className="text-sm text-gray-600">
                      {service.duration_minutes} min · {service.active ? "Activo" : "Inactivo"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      service.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {service.active ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px_160px_auto]">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Nombre</span>
                    <input
                      type="text"
                      value={service.name}
                      onChange={(event) =>
                        handleServiceChange(service.id, "name", event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Duración</span>
                    <input
                      type="number"
                      min={1}
                      value={service.duration_minutes}
                      onChange={(event) =>
                        handleServiceChange(
                          service.id,
                          "duration_minutes",
                          Number(event.target.value),
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                    />
                  </label>

                  <label className="flex items-end gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      checked={service.active}
                      onChange={(event) =>
                        handleServiceChange(service.id, "active", event.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    <span className="text-sm font-medium text-gray-700">Activo</span>
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => void handleSave(service)}
                      disabled={savingId === service.id}
                      className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingId === service.id ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {!loading && services.length === 0 ? (
              <p className="text-sm text-gray-600">No hay servicios creados todavía.</p>
            ) : null}
          </div>

          {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
          {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}
        </section>
      </div>
    </div>
  );
}

export default function ClinicServicesRoute() {
  return <ClinicServicesPage />;
}
