"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nextPath = searchParams.get("next")?.trim() || null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        throw new Error(error?.message ?? "No se pudo iniciar sesion");
      }

      router.replace(nextPath || "/clinic");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo iniciar sesion");
    } finally {
      setSubmitting(false);
    }
  };

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
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
          placeholder="Tu password"
          required
        />
      </label>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <div className="text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-primary underline">
          Has olvidado tu password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-[10px] bg-primary px-5 py-3 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
