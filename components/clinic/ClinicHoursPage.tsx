"use client";

import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { useEffect, useState } from "react";

type ClinicHourRow = {
  id?: string;
  clinic_slug: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  active: boolean;
};

type ClinicHoursResponse = {
  clinicHours?: ClinicHourRow[];
  error?: string;
};

type ClinicHourMutationResponse = {
  clinicHour?: ClinicHourRow;
  error?: string;
};

const WEEK_DAYS = [
  { day_of_week: 1, label: "Lunes" },
  { day_of_week: 2, label: "Martes" },
  { day_of_week: 3, label: "Miércoles" },
  { day_of_week: 4, label: "Jueves" },
  { day_of_week: 5, label: "Viernes" },
  { day_of_week: 6, label: "Sábado" },
  { day_of_week: 7, label: "Domingo" },
] as const;

function getDefaultHours(clinicSlug: string): ClinicHourRow[] {
  return WEEK_DAYS.map((day) => ({
    clinic_slug: clinicSlug,
    day_of_week: day.day_of_week,
    start_time: "09:00",
    end_time: "18:00",
    active: false,
  }));
}

type ClinicHoursPageProps = {
  clinicSlug?: string;
};

export function ClinicHoursPage({ clinicSlug = PANEL_CLINIC_SLUG }: ClinicHoursPageProps) {
  const [hours, setHours] = useState<ClinicHourRow[]>(getDefaultHours(clinicSlug));
  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHours = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/clinic-hours?clinicSlug=${clinicSlug}`);
      const data = (await response.json()) as ClinicHoursResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudieron cargar los horarios");
      }

      const byDay = new Map((data.clinicHours ?? []).map((item) => [item.day_of_week, item]));
      setHours(
        WEEK_DAYS.map((day) => {
          const existing = byDay.get(day.day_of_week);
          return (
            existing ?? {
              clinic_slug: clinicSlug,
              day_of_week: day.day_of_week,
              start_time: "09:00",
              end_time: "18:00",
              active: false,
            }
          );
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los horarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHours();
  }, []);

  const handleChange = (
    dayOfWeek: number,
    field: "start_time" | "end_time" | "active",
    value: string | boolean,
  ) => {
    setHours((current) =>
      current.map((item) =>
        item.day_of_week === dayOfWeek
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  };

  const handleSave = async (hour: ClinicHourRow) => {
    setSavingDay(hour.day_of_week);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/clinic-hours/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clinic_slug: clinicSlug,
          day_of_week: hour.day_of_week,
          start_time: hour.start_time,
          end_time: hour.end_time,
          active: hour.active,
        }),
      });

      const data = (await response.json()) as ClinicHourMutationResponse;

      if (!response.ok || !data.clinicHour) {
        throw new Error(data.error ?? "No se pudo guardar el horario");
      }

      await loadHours();
      setMessage("Guardado correctamente");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar el horario");
    } finally {
      setSavingDay(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Horarios de la clínica
          </h1>
          <p className="mt-2 text-sm text-gray-600">Configura los horarios de {clinicSlug}</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Horario semanal</h2>
            {loading ? <p className="text-sm text-gray-500">Cargando...</p> : null}
          </div>

          <div className="mt-4 space-y-4">
            {hours.map((hour) => {
              const day = WEEK_DAYS.find((item) => item.day_of_week === hour.day_of_week);

              return (
                <article
                  key={hour.day_of_week}
                  className="rounded-2xl border border-gray-200 bg-slate-50 p-4"
                >
                  <div className="grid gap-4 md:grid-cols-[180px_1fr_1fr_auto] md:items-end">
                    <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3">
                      <input
                        type="checkbox"
                        checked={hour.active}
                        onChange={(event) =>
                          handleChange(hour.day_of_week, "active", event.target.checked)
                        }
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        {day?.label ?? `Día ${hour.day_of_week}`}
                      </span>
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Inicio</span>
                      <input
                        type="time"
                        value={hour.start_time.slice(0, 5)}
                        onChange={(event) =>
                          handleChange(hour.day_of_week, "start_time", event.target.value)
                        }
                        disabled={!hour.active}
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Fin</span>
                      <input
                        type="time"
                        value={hour.end_time.slice(0, 5)}
                        onChange={(event) =>
                          handleChange(hour.day_of_week, "end_time", event.target.value)
                        }
                        disabled={!hour.active}
                        className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => void handleSave(hour)}
                      disabled={savingDay === hour.day_of_week}
                      className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingDay === hour.day_of_week ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
          {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}
        </section>
      </div>
    </div>
  );
}

export default function ClinicHoursRoute() {
  return <ClinicHoursPage />;
}
