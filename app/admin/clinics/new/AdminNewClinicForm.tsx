"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminNewClinicForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [themeColor, setThemeColor] = useState("#0E9E82");
  const [description, setDescription] = useState("");
  const [accessEmail, setAccessEmail] = useState("");
  const [seedDefaultServices, setSeedDefaultServices] = useState(true);
  const [seedDefaultHours, setSeedDefaultHours] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [createdClinicSlug, setCreatedClinicSlug] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setSlug("");
    setPhone("");
    setAddress("");
    setThemeColor("#0E9E82");
    setDescription("");
    setAccessEmail("");
    setSeedDefaultServices(true);
    setSeedDefaultHours(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setAccessMessage(null);
    setCreatedClinicSlug(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setAccessMessage(null);
    setCreatedClinicSlug(null);

    try {
      const response = await fetch("/api/admin/create-clinic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": process.env.NEXT_PUBLIC_ADMIN_API_SECRET ?? "",
        },
        body: JSON.stringify({
          name,
          slug,
          phone,
          address,
          theme_color: themeColor,
          description: description || null,
          access_email: accessEmail.trim().toLowerCase() || null,
          seed_default_services: seedDefaultServices,
          seed_default_hours: seedDefaultHours,
        }),
      });

      const data = (await response.json()) as {
        clinic?: { slug: string };
        access?: { attempted: boolean; success?: boolean; email?: string; error?: string };
        error?: string;
      };

      if (!response.ok || !data.clinic) {
        throw new Error(data.error ?? "No se pudo crear la clínica");
      }

      setCreatedClinicSlug(data.clinic.slug);
      setSuccessMessage("Clínica creada correctamente.");

      if (data.access?.attempted) {
        setAccessMessage(
          data.access.success
            ? `Acceso principal creado para ${data.access.email}. Ya se ha enviado el email para definir password.`
            : `Clínica creada, pero no se pudo crear el acceso para ${data.access.email}: ${data.access.error ?? "error desconocido"}`,
        );
      } else {
        setAccessMessage(
          "No se ha creado acceso principal porque no se indico un email de acceso.",
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo crear la clínica",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6 lg:px-6 lg:py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="rounded-[14px] border-[0.5px] border-border bg-card p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                Admin interno
              </p>
              <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-foreground">
                Nueva clinica
              </h1>
              <p className="mt-2 text-sm text-muted">
                Crea una clinica piloto y dejala preparada para panel, pagina
                publica, servicios y horarios base.
              </p>
            </div>

            <Link
              href="/admin/clinics"
              className="inline-flex items-center justify-center rounded-[10px] border-[0.5px] border-border px-4 py-2.5 font-heading text-sm font-semibold text-muted transition-all duration-150 hover:border-primary/30 hover:text-foreground"
            >
              Volver al listado
            </Link>
          </div>
        </section>

        <section className="rounded-[14px] border-[0.5px] border-border bg-card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-foreground">Nombre</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-foreground">Slug</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-foreground">Teléfono</span>
                <input
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-foreground">Color</span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(event) => setThemeColor(event.target.value)}
                    className="h-12 w-14 rounded-[10px] border border-border bg-white p-1"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={(event) => setThemeColor(event.target.value)}
                    className="w-full rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
                  />
                </div>
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-foreground">Dirección</span>
              <input
                type="text"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-foreground">
                Descripcion opcional
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-foreground">
                Email de acceso principal
              </span>
              <input
                type="email"
                value={accessEmail}
                onChange={(event) => setAccessEmail(event.target.value)}
                placeholder="doctora@clinica.com"
                className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-3.5 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
              />
              <p className="mt-2 text-xs text-muted">
                Opcional. Si lo rellenas, se creara el acceso principal y se
                enviara el email para definir password.
              </p>
            </label>

            <div className="rounded-[14px] border border-border bg-background p-5">
              <p className="text-sm font-medium text-foreground">
                Preparacion inicial
              </p>
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-3 rounded-[10px] border border-border bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={seedDefaultServices}
                    onChange={(event) => setSeedDefaultServices(event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm text-foreground">Crear servicios base</span>
                </label>
                <label className="flex items-center gap-3 rounded-[10px] border border-border bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={seedDefaultHours}
                    onChange={(event) => setSeedDefaultHours(event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm text-foreground">Crear horarios base</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creando..." : "Crear clinica"}
              </button>
              <Link
                href="/admin/clinics"
                className="rounded-[10px] border-[1.5px] border-primary px-5 py-2.5 font-heading text-sm font-semibold text-primary transition-all duration-150 hover:bg-primary-soft"
              >
                Cancelar
              </Link>
            </div>

            {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
            {successMessage ? (
              <p className="text-sm text-primary">{successMessage}</p>
            ) : null}
            {accessMessage ? <p className="text-sm text-foreground">{accessMessage}</p> : null}

            {createdClinicSlug ? (
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href={`/clinic/${createdClinicSlug}`}
                  className="rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover"
                >
                  Ir al panel de la clinica
                </Link>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-[10px] border-[1.5px] border-primary px-5 py-2.5 font-heading text-sm font-semibold text-primary transition-all duration-150 hover:bg-primary-soft"
                >
                  Crear otra clinica
                </button>
              </div>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}
