"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Link from "next/link";
import { useState } from "react";

export function RegisterForm() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        throw new Error(error.message);
      }

      setSuccess(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo crear la cuenta");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
          <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-foreground">Cuenta creada</p>
        <p className="text-sm text-muted">
          Revisa tu email para confirmar tu cuenta antes de acceder.
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
        <span className="text-sm font-medium text-foreground">Password</span>
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

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <button
        type="submit"
        disabled={submitting}
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
