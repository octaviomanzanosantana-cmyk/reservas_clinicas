"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const [clinicName, setClinicName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState(""); // honeypot: humanos no lo ven
  const [submitting, setSubmitting] = useState(false);
  const [dpaAccepted, setDpaAccepted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          clinicName: clinicName.trim(),
          dpa_accepted: true,
          website,
        }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string; message?: string };

      // Honeypot disparado: error suave, resetea campo oculto y pide reintentar.
      if (data.error === "signup_verification_failed") {
        setWebsite("");
        throw new Error(
          data.message ?? "Hubo un problema procesando tu registro. Por favor, inténtalo de nuevo.",
        );
      }

      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo crear la cuenta");
      }

      setSuccess(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo crear la cuenta",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
          <svg
            className="h-6 w-6 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <p className="text-sm font-semibold text-foreground">Revisa tu email</p>
        <p className="text-sm text-muted">
          Te hemos enviado un enlace de confirmación a <strong>{email}</strong>. Haz clic en el
          botón del email para activar tu cuenta.
        </p>
        <p className="text-xs text-muted">
          Si no lo encuentras, revisa la carpeta de spam o promociones. El email puede tardar un
          par de minutos.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-primary underline"
        >
          Ir al login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot — bots rellenan, humanos no lo ven (display:none + offscreen) */}
      <div aria-hidden="true" style={{ display: "none", position: "absolute", left: "-9999px" }}>
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-foreground">
          Nombre de tu clínica
        </span>
        <input
          type="text"
          value={clinicName}
          onChange={(event) => setClinicName(event.target.value)}
          className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
          placeholder="Clínica San Juan"
          required
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-foreground">Email</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
          placeholder="tu@clinica.com"
          required
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-foreground">Contraseña</span>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
          placeholder="Mínimo 8 caracteres"
          minLength={8}
          required
        />
      </label>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={dpaAccepted}
          onChange={(e) => setDpaAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
          required
        />
        <span className="text-sm text-muted">
          He leído y acepto el{" "}
          <a
            href="/dpa"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline"
          >
            Contrato de Encargo de Tratamiento (DPA)
          </a>
          {" "}de AppoClick, que regula el tratamiento de los datos de mis pacientes.
        </span>
      </label>

      {errorMessage ? (
        <p className="text-sm text-red-600">{errorMessage}</p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || !dpaAccepted}
        className="w-full rounded-[10px] bg-primary px-5 py-3 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Creando cuenta..." : "Crear cuenta"}
      </button>

      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary underline">
          Acceder
        </Link>
      </p>
    </form>
  );
}
