"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Link from "next/link";
import { useEffect, useState } from "react";

export function ResetPasswordForm() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setErrorMessage(error.message);
      }

      setHasRecoverySession(Boolean(data.session));
      setCheckingSession(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true);
        setCheckingSession(false);
      }
    });

    void checkSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (!hasRecoverySession) {
        throw new Error("El enlace de recuperación no es válido o ha expirado.");
      }

      if (password.length < 8) {
        throw new Error("La password debe tener al menos 8 caracteres.");
      }

      if (password !== confirmPassword) {
        throw new Error("Las passwords no coinciden.");
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        throw error;
      }

      setSuccessMessage("Tu password se ha actualizado correctamente. Ya puedes iniciar sesión.");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo actualizar la password",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return <p className="text-sm text-slate-600">Validando enlace de recuperación...</p>;
  }

  return (
    <div className="space-y-5">
      {!hasRecoverySession ? (
        <div className="space-y-4">
          <p className="text-sm text-red-600">
            El enlace de recuperación no es válido o ya ha expirado.
          </p>
          <Link href="/forgot-password" className="text-sm font-medium text-slate-900 underline">
            Solicitar un nuevo enlace
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Nueva password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-300"
              placeholder="Minimo 8 caracteres"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Repetir password</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-slate-300"
              placeholder="Repite la password"
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
            {submitting ? "Actualizando..." : "Actualizar password"}
          </button>
        </form>
      )}
    </div>
  );
}
