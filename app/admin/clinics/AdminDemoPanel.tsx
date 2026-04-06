"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ClinicItem = {
  id: string;
  slug: string;
  name: string;
  is_demo: boolean;
  created_at: string;
};

type Filter = "all" | "demo" | "real";

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

const INPUT_CLASS = "mt-1 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary";

export default function AdminDemoPanel() {
  const [allClinics, setAllClinics] = useState<ClinicItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isDemo, setIsDemo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadClinics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/demo-clinics?all=1");
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

  const handleDelete = async (clinicId: string) => {
    if (!confirm("¿Eliminar esta clínica y todos sus datos?")) return;
    setDeleting(clinicId);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/demo-clinics", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_id: clinicId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Error al eliminar");
      }
      setMessage("Clínica eliminada");
      void loadClinics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">Administración</p>
          <h1 className="mt-2 font-heading text-2xl font-bold text-foreground">Gestión de clínicas</h1>
          <p className="mt-1 text-sm text-muted">Crea clínicas y gestiona el onboarding. El email recibe invitación automática con branding Appoclick.</p>
        </div>

        {/* Formulario */}
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

        {/* Listado */}
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
                    <th className="px-4 py-2.5 font-medium">Nombre</th>
                    <th className="px-4 py-2.5 font-medium">Slug</th>
                    <th className="px-4 py-2.5 font-medium">Tipo</th>
                    <th className="px-4 py-2.5 font-medium">Fecha</th>
                    <th className="px-4 py-2.5 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClinics.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-foreground">{c.name}</td>
                      <td className="px-4 py-2.5 text-muted">{c.slug}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.is_demo
                            ? "bg-[var(--badge-pending-bg)] text-[var(--badge-pending-text)]"
                            : "bg-[var(--badge-confirmed-bg)] text-[var(--badge-confirmed-text)]"
                        }`}>
                          {c.is_demo ? "Demo" : "Real"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{new Date(c.created_at).toLocaleDateString("es-ES")}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-2">
                          <Link href={`/b/${c.slug}`} target="_blank" className="rounded-[8px] border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground">
                            Reservas
                          </Link>
                          <button
                            type="button"
                            onClick={() => { void navigator.clipboard.writeText(`https://app.appoclick.com/b/${c.slug}`); }}
                            className="rounded-[8px] border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground"
                          >
                            Copiar URL
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(c.id)}
                            disabled={deleting === c.id}
                            className="rounded-[8px] border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            {deleting === c.id ? "..." : "Eliminar"}
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
