"use client";

import { EditPatientModal, type EditableAppointment } from "@/components/clinic/EditPatientModal";
import { PANEL_CLINIC_SLUG } from "@/lib/clinicPanel";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type AppointmentRow = {
  id: number;
  token: string;
  patient_name: string;
  patient_email?: string | null;
  patient_phone?: string | null;
  service: string;
  scheduled_at: string | null;
  datetime_label: string;
  status: string;
  modality?: string | null;
  appointment_type?: string | null;
  video_link?: string | null;
  review_sent_at?: string | null;
  updated_at: string;
};

type ServiceOption = { name: string };

type SearchResponse = {
  appointments: AppointmentRow[];
  total: number;
  page: number;
  totalPages: number;
  error?: string;
};

type ClinicPatientsPageProps = {
  clinicSlug?: string;
  basePath?: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Asistió",
  change_requested: "Reprogramada",
};

const STATUS_BADGE: Record<string, string> = {
  confirmed: "bg-[var(--badge-confirmed-bg)] text-[var(--badge-confirmed-text)]",
  completed: "bg-[var(--badge-confirmed-bg)] text-[var(--badge-confirmed-text)]",
  pending: "bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]",
  change_requested: "bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]",
  cancelled: "bg-[var(--badge-cancelled-bg)] text-[var(--badge-cancelled-text)]",
};

function formatDate(scheduledAt: string | null, fallback: string): string {
  if (!scheduledAt) return fallback;
  const d = new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function ClinicPatientsPage({
  clinicSlug = PANEL_CLINIC_SLUG,
  basePath = "/clinic",
}: ClinicPatientsPageProps) {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [clinicPlan, setClinicPlan] = useState("free");
  const [services, setServices] = useState<ServiceOption[]>([]);

  // Filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [modalityFilter, setModalityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Edit modal
  const [editingAppointment, setEditingAppointment] = useState<AppointmentRow | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Delete modal
  const [deleteEmail, setDeleteEmail] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Load clinic plan + services
  useEffect(() => {
    fetch(`/api/clinics?slug=${encodeURIComponent(clinicSlug)}`)
      .then((r) => r.json())
      .then((d: { clinic?: { plan?: string } }) => {
        if (d.clinic?.plan) setClinicPlan(d.clinic.plan);
      })
      .catch(() => {});

    fetch(`/api/services?clinicSlug=${encodeURIComponent(clinicSlug)}`)
      .then((r) => r.json())
      .then((d: { services?: ServiceOption[] }) => {
        setServices(d.services ?? []);
      })
      .catch(() => {});
  }, [clinicSlug]);

  const loadResults = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (query) params.set("q", query);
      if (statusFilter) params.set("status", statusFilter);
      if (serviceFilter) params.set("service", serviceFilter);
      if (modalityFilter) params.set("modality", modalityFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const response = await fetch(`/api/appointments/search?${params.toString()}`);
      const data = (await response.json()) as SearchResponse;

      if (response.ok) {
        setAppointments(data.appointments);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(p);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [query, statusFilter, serviceFilter, modalityFilter, dateFrom, dateTo]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => { void loadResults(1); }, 300);
    return () => clearTimeout(timer);
  }, [loadResults]);

  const handleSavePatient = useCallback(async (data: {
    token: string;
    patient_name: string;
    patient_email: string | null;
    patient_phone: string | null;
    modality: string;
    video_link: string | null;
  }) => {
    const response = await fetch("/api/appointments/update-patient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = (await response.json()) as { appointment?: AppointmentRow; error?: string };

    if (!response.ok || !result.appointment) {
      throw new Error(result.error ?? "No se pudo actualizar");
    }

    setAppointments((current) =>
      current.map((a) => (a.token === data.token ? { ...a, ...result.appointment! } : a)),
    );
    setEditingAppointment(null);
    setFeedback("Datos actualizados correctamente");
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const handleDeletePatient = async () => {
    if (!deleteEmail) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/appointments/delete-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_email: deleteEmail }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Error");

      setDeleteEmail(null);
      setDeleteConfirmText("");
      setQuery("");
      setFeedback("Los datos de este paciente han sido eliminados correctamente.");
      setTimeout(() => setFeedback(null), 5000);
      void loadResults(1);
    } catch {
      setFeedback("No se pudo eliminar. Inténtalo de nuevo.");
    } finally {
      setDeleting(false);
    }
  };

  // Show ARCO button only when searching by exact email
  const isExactEmailSearch = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q.includes("@") && appointments.length > 0 && appointments.every(
      (a) => a.patient_email?.toLowerCase() === q,
    );
  }, [query, appointments]);

  return (
    <div className="space-y-6">
      {/* Edit modal */}
      {editingAppointment ? (
        <EditPatientModal
          appointment={editingAppointment}
          clinicPlan={clinicPlan}
          basePath={basePath}
          formatDate={formatDate}
          onSave={handleSavePatient}
          onClose={() => setEditingAppointment(null)}
        />
      ) : null}

      {/* Delete modal */}
      {deleteEmail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-[14px] border-[0.5px] border-[#E5E7EB] bg-white p-6 shadow-xl">
            <h2 className="font-heading text-lg font-semibold text-red-600">Eliminar datos de paciente</h2>
            <p className="mt-3 text-sm text-muted">
              Vas a eliminar permanentemente todas las citas de:
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{deleteEmail}</p>
            <p className="mt-3 text-sm text-red-600">Esta acción no se puede deshacer.</p>

            <div className="mt-5">
              <p className="text-sm text-muted">Para confirmar, escribe <strong>ELIMINAR</strong> en el campo:</p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-2 w-full rounded-[10px] border-[1.5px] border-[#E5E7EB] px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-red-400"
                placeholder="Escribe ELIMINAR"
              />
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => void handleDeletePatient()}
                disabled={deleteConfirmText !== "ELIMINAR" || deleting}
                className="rounded-[10px] bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? "Eliminando..." : "Confirmar eliminación"}
              </button>
              <button
                type="button"
                onClick={() => { setDeleteEmail(null); setDeleteConfirmText(""); }}
                className="rounded-[10px] border-[0.5px] border-[#E5E7EB] px-5 py-2.5 text-sm font-semibold text-[#6B7280] transition-colors hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Header */}
      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">Gestión</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Pacientes</h1>
        <p className="mt-2 text-sm text-muted">Busca, filtra y gestiona todas las citas de tus pacientes.</p>
      </section>

      {feedback ? (
        <p className="flex items-center gap-1.5 text-sm text-primary">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {feedback}
        </p>
      ) : null}

      {/* Search + Filters */}
      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o email..."
          className="w-full rounded-[10px] border-[1.5px] border-[#E5E7EB] px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-[#0E9E82]"
        />
        <p className="mt-1.5 text-xs text-muted">Para eliminar los datos de un paciente, busca por su email exacto.</p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-foreground"
          >
            <option value="">Todas</option>
            <option value="confirmed">Confirmada</option>
            <option value="cancelled">Cancelada</option>
            <option value="completed">Asistió</option>
            <option value="pending">Pendiente</option>
          </select>

          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-foreground"
          >
            <option value="">Todos los servicios</option>
            {services.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>

          <select
            value={modalityFilter}
            onChange={(e) => setModalityFilter(e.target.value)}
            className="rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-foreground"
          >
            <option value="">Todas</option>
            <option value="presencial">Presencial</option>
            <option value="online">Online</option>
          </select>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-muted">Fecha desde</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full min-w-[140px] rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted">Fecha hasta</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full min-w-[140px] rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-muted">
          {loading ? "Buscando..." : `${total} resultado${total !== 1 ? "s" : ""}`}
        </p>
      </section>

      {/* Results table */}
      <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
        <div className="overflow-x-auto rounded-[14px] border border-border bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="px-4 py-3 font-medium">Paciente</th>
                <th className="px-4 py-3 font-medium">Servicio</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Fecha/hora</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {appointments.map((a) => (
                <tr key={a.id} className="text-foreground transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setEditingAppointment(a)}
                      className="font-medium text-[#0E9E82] cursor-pointer transition-colors hover:underline"
                    >
                      {a.patient_name}
                    </button>
                    {a.patient_email ? (
                      <p className="text-xs text-muted">{a.patient_email}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{a.service}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                        {a.appointment_type === "revision" ? "Revisión" : "Primera visita"}
                      </span>
                      <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted">
                        {a.modality === "online" ? "Online" : "Presencial"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatDate(a.scheduled_at, a.datetime_label)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE[a.status] ?? STATUS_BADGE.cancelled}`}>
                      {STATUS_LABELS[a.status] ?? a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && appointments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No se encontraron resultados.</p>
          ) : null}
        </div>

        {/* Pagination */}
        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void loadResults(page - 1)}
              disabled={page <= 1}
              className="rounded-[10px] border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground disabled:opacity-40"
            >
              ← Anterior
            </button>
            <span className="text-sm text-muted">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => void loadResults(page + 1)}
              disabled={page >= totalPages}
              className="rounded-[10px] border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        ) : null}
      </section>

      {/* ARCO delete button */}
      {isExactEmailSearch ? (
        <section className="rounded-[14px] border-[0.5px] border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-800">
            Se muestran todas las citas de <strong>{query.trim()}</strong>.
          </p>
          <button
            type="button"
            onClick={() => setDeleteEmail(query.trim().toLowerCase())}
            className="mt-3 rounded-[10px] border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            Eliminar datos de este paciente
          </button>
        </section>
      ) : null}
    </div>
  );
}

export default function ClinicPatientsRoute() {
  return <ClinicPatientsPage />;
}
