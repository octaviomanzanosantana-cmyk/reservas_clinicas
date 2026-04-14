"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ClinicItem = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  is_demo: boolean;
  created_at: string;
  owner_email: string | null;
  appointment_count: number;
};

type Filter = "all" | "demo" | "real";

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

const INPUT_CLASS = "mt-1 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary";

const PLAN_BADGE: Record<string, string> = {
  free: "bg-slate-100 text-slate-600",
  starter: "bg-emerald-100 text-emerald-700",
  pro: "bg-violet-100 text-violet-700",
};

export default function AdminDemoPanel() {
  const [allClinics, setAllClinics] = useState<ClinicItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isDemo, setIsDemo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ClinicItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Plan change
  const [changingPlan, setChangingPlan] = useState<string | null>(null);

  const loadClinics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/clinic-stats");
      const data = (await res.json()) as { clinics?: ClinicItem[] };
      setAllClinics(data.clinics ?? []);
    } catch {
      setAllClinics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadClinics(); }, [loadClinics]);

  const filteredClinics = allClinics.filter((c) => {
    if (filter === "demo") return c.is_demo;
    if (filter === "real") return !c.is_demo;
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/auth/register-clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          is_demo: isDemo,
          invited: true,
        }),
      });

      const data = (await res.json()) as { clinic?: { slug: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al crear");

      setMessage(`Clínica "${name}" creada. Email de bienvenida enviado a ${email}.`);
      setName("");
      setEmail("");
      void loadClinics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/demo-clinics", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_id: deleteTarget.id }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Error al eliminar");
      }
      setMessage(`Clínica "${deleteTarget.name}" eliminada`);
      setDeleteTarget(null);
      setDeleteConfirmText("");
      void loadClinics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const handleChangePlan = async (clinicId: string, plan: string) => {
    setChangingPlan(clinicId);
    try {
      const res = await fetch("/api/admin/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_id: clinicId, plan }),
      });
      if (!res.ok) throw new Error("Error al cambiar plan");

      setAllClinics((current) =>
        current.map((c) => (c.id === clinicId ? { ...c, plan } : c)),
      );
      setMessage(`Plan cambiado a ${plan}`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setChangingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Delete modal */}
        {deleteTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="mx-4 w-full max-w-md rounded-[14px] border-[0.5px] border-[#E5E7EB] bg-white p-6 shadow-xl">
              <h2 className="font-heading text-lg font-semibold text-red-600">Eliminar clínica</h2>
              <p className="mt-3 text-sm text-muted">
                Vas a eliminar permanentemente <strong className="text-foreground">{deleteTarget.name}</strong> y todos sus datos (citas, servicios, horarios, usuario).
              </p>
              <p className="mt-2 text-sm text-red-600">Esta acción no se puede deshacer.</p>

              <div className="mt-5">
                <p className="text-sm text-muted">Para confirmar, escribe <strong>ELIMINAR</strong>:</p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="mt-2 w-full rounded-[10px] border-[1.5px] border-[#E5E7EB] px-3.5 py-2.5 text-sm outline-none focus:border-red-400"
                  placeholder="Escribe ELIMINAR"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleteConfirmText !== "ELIMINAR" || deleting}
                  className="rounded-[10px] bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deleting ? "Eliminando..." : "Confirmar eliminación"}
                </button>
                <button
                  type="button"
                  onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
                  className="rounded-[10px] border-[0.5px] border-[#E5E7EB] px-5 py-2.5 text-sm font-semibold text-[#6B7280] hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Header */}
        <div className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">Administración</p>
              <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">Gestión de clínicas</h1>
              <p className="mt-1 text-sm text-muted">Crea clínicas, gestiona planes y accede a sus paneles.</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                const supabase = createSupabaseBrowserClient();
                await supabase.auth.signOut();
                window.location.href = "/login";
              }}
              className="shrink-0 rounded-[10px] border-[0.5px] border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* Create form */}
        <div className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold text-foreground">Nueva clínica</h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-foreground">Nombre de la clínica</span>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Clínica Ejemplo" required className={INPUT_CLASS} />
                {name.trim() ? <p className="mt-1 text-xs text-muted">Slug: {normalizeSlug(name)}</p> : null}
              </label>
              <label className="block">
                <span className="text-sm font-medium text-foreground">Email del administrador</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doctor@clinica.com" required className={INPUT_CLASS} />
                <p className="mt-1 text-xs text-muted">Recibirá email de bienvenida para activar su cuenta</p>
              </label>
            </div>
            <label className="flex items-center gap-2.5 rounded-[10px] border border-border bg-background px-3.5 py-3">
              <input type="checkbox" checked={isDemo} onChange={(e) => setIsDemo(e.target.checked)} className="h-4 w-4 accent-primary" />
              <span className="text-sm text-foreground">Marcar como demo</span>
            </label>
            <button type="submit" disabled={submitting} className="rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60">
              {submitting ? "Creando..." : "Crear clínica"}
            </button>
          </form>
          {message ? <p className="mt-3 text-sm text-primary">{message}</p> : null}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>

        {/* Clinic list */}
        <div className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="font-heading text-lg font-semibold text-foreground">Clínicas ({filteredClinics.length})</h2>
            <div className="flex gap-1.5">
              {(["all", "demo", "real"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-[8px] px-3 py-1.5 text-xs font-medium transition-all ${
                    filter === f ? "bg-primary text-white" : "border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {f === "all" ? "Todas" : f === "demo" ? "Demos" : "Reales"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-muted">Cargando...</p>
          ) : filteredClinics.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No hay clínicas.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-[10px] border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="px-4 py-2.5 font-medium">Clínica</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Plan</th>
                    <th className="px-4 py-2.5 font-medium">Citas</th>
                    <th className="px-4 py-2.5 font-medium">Tipo</th>
                    <th className="px-4 py-2.5 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClinics.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted">{c.slug}</p>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{c.owner_email ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={c.plan ?? "free"}
                          onChange={(e) => void handleChangePlan(c.id, e.target.value)}
                          disabled={changingPlan === c.id}
                          className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-semibold ${PLAN_BADGE[c.plan] ?? PLAN_BADGE.free} cursor-pointer disabled:opacity-60`}
                        >
                          <option value="free">Free</option>
                          <option value="starter">Starter</option>
                          <option value="pro">Pro</option>
                        </select>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{c.appointment_count}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.is_demo
                            ? "bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]"
                            : "bg-[var(--badge-confirmed-bg)] text-[var(--badge-confirmed-text)]"
                        }`}>
                          {c.is_demo ? "Demo" : "Real"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <a
                            href={`/clinic/${c.slug}`}
                            target="_blank"
                            rel="noopener"
                            className="rounded-[8px] bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
                          >
                            Entrar al panel
                          </a>
                          <Link href={`/b/${c.slug}`} target="_blank" className="rounded-[8px] border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground">
                            Reservas
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            className="rounded-[8px] border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
