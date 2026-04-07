"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useState } from "react";

const RECOVERY_REDIRECT_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.appoclick.com";

export function ForgotPasswordForm() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${RECOVERY_REDIRECT_URL.replace(/\/+$/, "")}/reset-password`,
      });

      if (error) {
        throw error;
      }

      setSuccessMessage(
        "Si el email existe, te hemos enviado un enlace para restablecer tu contraseña.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo enviar el email de recuperación",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-300"
          placeholder="tu@clinica.com"
          required
        />
      </label>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_18px_34px_-22px_rgba(15,23,42,0.65)] transition-all duration-150 hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Enviando..." : "Enviar enlace de recuperación"}
      </button>
    </form>
  );
}
