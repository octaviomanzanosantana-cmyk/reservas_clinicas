"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ClinicBlock = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
};

type ClinicBlocksSectionProps = {
  clinicSlug: string;
};

const INPUT_CLASS =
  "mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]";

function todayIso(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatBlockDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function ClinicBlocksSection({ clinicSlug }: ClinicBlocksSectionProps) {
  const [blocks, setBlocks] = useState<ClinicBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [conflictCount, setConflictCount] = useState<number | null>(null);

  const today = useMemo(() => todayIso(), []);

  const loadBlocks = useCallback(async () => {
    try {
      const res = await fetch(`/api/clinic-blocks?clinicSlug=${encodeURIComponent(clinicSlug)}`);
      const data = (await res.json()) as { blocks?: ClinicBlock[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar los bloqueos");
      setBlocks(data.blocks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar bloqueos");
    }
  }, [clinicSlug]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await loadBlocks();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [loadBlocks]);

  function validate(): string | null {
    if (!startDate) return "Fecha inicio requerida.";
    if (!endDate) return "Fecha fin requerida.";
    if (endDate < startDate) return "La fecha fin debe ser igual o posterior a la fecha inicio.";
    if (startDate < today) return "Solo puedes bloquear fechas futuras.";
    if (reason.length > 100) return "El motivo no puede superar 100 caracteres.";
    return null;
  }

  async function submitCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/clinic-blocks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicSlug,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim() || null,
        }),
      });
      const data = (await res.json()) as { block?: ClinicBlock; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el bloqueo");

      setStartDate("");
      setEndDate("");
      setReason("");
      setConflictCount(null);
      setMessage("Bloqueo añadido.");
      await loadBlocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear bloqueo");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddClick() {
    setError(null);
    setMessage(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    try {
      const countRes = await fetch(
        `/api/clinic-blocks/count-appointments?clinicSlug=${encodeURIComponent(clinicSlug)}&start_date=${startDate}&end_date=${endDate}`,
      );
      const countData = (await countRes.json()) as { count?: number; error?: string };
      if (!countRes.ok) throw new Error(countData.error ?? "Error al comprobar citas");

      if ((countData.count ?? 0) > 0) {
        setConflictCount(countData.count ?? 0);
        return; // Espera a que el usuario confirme en el modal
      }

      await submitCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/clinic-blocks/${id}?clinicSlug=${encodeURIComponent(clinicSlug)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo eliminar");
      await loadBlocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  return (
    <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
      <h2 className="font-heading text-lg font-semibold text-foreground">Vacaciones y bloqueos</h2>
      <p className="mt-1 text-sm text-muted">
        Bloquea rangos de fechas para que los pacientes no puedan reservar durante esos periodos.
      </p>

      <div className="mt-5 rounded-[14px] border-[0.5px] border-border bg-background p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Fecha inicio</span>
            <input
              type="date"
              value={startDate}
              min={today}
              onChange={(e) => setStartDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">Fecha fin</span>
            <input
              type="date"
              value={endDate}
              min={startDate || today}
              onChange={(e) => setEndDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-foreground">Motivo (opcional)</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Vacaciones, formación..."
            maxLength={100}
            className={INPUT_CLASS}
          />
        </label>

        <button
          type="button"
          onClick={() => void handleAddClick()}
          disabled={submitting}
          className="mt-5 rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Añadiendo..." : "+ Añadir bloqueo"}
        </button>
      </div>

      <div className="mt-6">
        <h3 className="font-heading text-sm font-semibold text-foreground">Bloqueos activos</h3>
        {loading ? (
          <p className="mt-3 text-sm text-muted">Cargando...</p>
        ) : blocks.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No hay bloqueos programados.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {blocks.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border-[0.5px] border-border bg-background px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {formatBlockDate(b.start_date)}
                    {b.end_date !== b.start_date ? ` – ${formatBlockDate(b.end_date)}` : ""}
                    {b.reason ? <span className="text-muted"> · {b.reason}</span> : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(b.id)}
                  className="rounded-[10px] border-[0.5px] border-border px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:text-foreground"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {message ? <p className="mt-4 text-sm text-primary">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {conflictCount !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-[14px] border-[0.5px] border-border bg-white p-6 shadow-xl">
            <h3 className="font-heading text-lg font-semibold text-foreground">
              Citas existentes en este rango
            </h3>
            <p className="mt-3 text-sm text-foreground">
              Hay <strong>{conflictCount}</strong> {conflictCount === 1 ? "cita ya reservada" : "citas ya reservadas"} entre el{" "}
              <strong>{formatBlockDate(startDate)}</strong> y el{" "}
              <strong>{formatBlockDate(endDate)}</strong>. Si bloqueas estas fechas, esas citas
              seguirán activas — te recomendamos contactarlas para reprogramar.
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setConflictCount(null)}
                className="rounded-[10px] border-[0.5px] border-border px-4 py-2.5 font-heading text-sm font-semibold text-muted transition-colors hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConflictCount(null);
                  void submitCreate();
                }}
                disabled={submitting}
                className="rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                Bloquear igualmente
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
