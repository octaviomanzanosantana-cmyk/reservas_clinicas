"use client";

import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import { useEffect, useMemo, useState } from "react";

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

const WEEK_DAYS = [
  { day_of_week: 1, label: "Lunes" },
  { day_of_week: 2, label: "Martes" },
  { day_of_week: 3, label: "Miércoles" },
  { day_of_week: 4, label: "Jueves" },
  { day_of_week: 5, label: "Viernes" },
  { day_of_week: 6, label: "Sábado" },
  { day_of_week: 7, label: "Domingo" },
] as const;

type ClinicHoursPageProps = {
  clinicSlug?: string;
};

export function ClinicHoursPage({ clinicSlug = PANEL_CLINIC_SLUG }: ClinicHoursPageProps) {
  const [hours, setHours] = useState<ClinicHourRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
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

      setHours(data.clinicHours ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar los horarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHours();
  }, []);

  const hoursByDay = useMemo(() => {
    const map = new Map<number, ClinicHourRow[]>();
    for (const day of WEEK_DAYS) {
      map.set(day.day_of_week, []);
    }
    for (const h of hours) {
      const arr = map.get(h.day_of_week);
      if (arr) arr.push(h);
    }
    return map;
  }, [hours]);

  const handleUpdate = async (hour: ClinicHourRow) => {
    if (!hour.id) return;
    const key = hour.id;
    setSavingId(key);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/clinic-hours/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: hour.id,
          start_time: hour.start_time,
          end_time: hour.end_time,
          active: hour.active,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Error al guardar");

      await loadHours();
      setMessage("Guardado correctamente");
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSavingId(null);
    }
  };

  const handleAddSlot = async (dayOfWeek: number) => {
    setSavingId(`add-${dayOfWeek}`);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/clinic-hours/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day_of_week: dayOfWeek,
          start_time: "16:00",
          end_time: "20:00",
          active: true,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Error al crear tramo");

      await loadHours();
      setMessage("Tramo añadido");
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo añadir tramo");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    setSavingId(id);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/clinic-hours/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Error al eliminar");

      await loadHours();
      setMessage("Tramo eliminado");
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo eliminar");
    } finally {
      setSavingId(null);
    }
  };

  const handleLocalChange = (
    id: string,
    field: "start_time" | "end_time" | "active",
    value: string | boolean,
  ) => {
    setHours((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Horarios de la clínica
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Configura los horarios de atención. Puedes añadir múltiples tramos por día (ej: mañana y tarde).
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Horario semanal</h2>
            {loading ? <p className="text-sm text-gray-500">Cargando...</p> : null}
          </div>

          <div className="mt-4 space-y-5">
            {WEEK_DAYS.map((weekDay) => {
              const daySlots = hoursByDay.get(weekDay.day_of_week) ?? [];
              const hasActive = daySlots.some((s) => s.active);

              return (
                <article
                  key={weekDay.day_of_week}
                  className="rounded-2xl border border-gray-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-sm font-semibold ${hasActive ? "text-gray-900" : "text-gray-400"}`}>
                      {weekDay.label}
                    </span>
                    {daySlots.length === 0 ? (
                      <span className="text-xs text-gray-400">Sin horario</span>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    {daySlots.map((slot, idx) => (
                      <div
                        key={slot.id ?? `new-${idx}`}
                        className="grid gap-3 md:grid-cols-[auto_1fr_1fr_auto_auto] md:items-end"
                      >
                        <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={slot.active}
                            onChange={(e) => {
                              if (slot.id) handleLocalChange(slot.id, "active", e.target.checked);
                            }}
                            className="h-4 w-4 accent-[#0E9E82]"
                          />
                          <span className="text-xs font-medium text-gray-600">
                            Tramo {idx + 1}
                          </span>
                        </label>

                        <label className="block">
                          <span className="text-xs font-medium text-gray-600">Inicio</span>
                          <input
                            type="time"
                            value={slot.start_time.slice(0, 5)}
                            onChange={(e) => {
                              if (slot.id) handleLocalChange(slot.id, "start_time", e.target.value);
                            }}
                            disabled={!slot.active}
                            className="mt-1 w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#0E9E82] disabled:cursor-not-allowed disabled:bg-gray-100"
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-medium text-gray-600">Fin</span>
                          <input
                            type="time"
                            value={slot.end_time.slice(0, 5)}
                            onChange={(e) => {
                              if (slot.id) handleLocalChange(slot.id, "end_time", e.target.value);
                            }}
                            disabled={!slot.active}
                            className="mt-1 w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#0E9E82] disabled:cursor-not-allowed disabled:bg-gray-100"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => void handleUpdate(slot)}
                          disabled={savingId === slot.id}
                          className="rounded-[10px] bg-[#0E9E82] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingId === slot.id ? "..." : "Guardar"}
                        </button>

                        {daySlots.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => { if (slot.id) void handleDeleteSlot(slot.id); }}
                            disabled={savingId === slot.id}
                            className="rounded-[10px] border-[0.5px] border-red-200 px-3 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-60"
                            title="Eliminar tramo"
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleAddSlot(weekDay.day_of_week)}
                    disabled={savingId === `add-${weekDay.day_of_week}`}
                    className="mt-3 rounded-[10px] border-[0.5px] border-[#E5E7EB] px-3 py-2 text-xs font-semibold text-[#6B7280] transition-colors hover:text-foreground disabled:opacity-60"
                  >
                    {savingId === `add-${weekDay.day_of_week}` ? "Añadiendo..." : "+ Añadir tramo"}
                  </button>
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
