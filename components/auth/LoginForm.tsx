"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type LoginResponse = {
  ok?: boolean;
  user_id?: string;
  access_token?: string;
  refresh_token?: string;
  error?: string;
  message?: string;
  minutes_left?: number;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [blockedMinutes, setBlockedMinutes] = useState(0);

  const nextPath = searchParams.get("next")?.trim() || null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    try {
      // Server-side login with rate limiting
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = (await response.json()) as LoginResponse;

      if (response.status === 429) {
        setBlocked(true);
        setBlockedMinutes(data.minutes_left ?? 15);
        setErrorMessage(data.message ?? "Demasiados intentos.");
        return;
      }

      if (!response.ok || !data.ok) {
        setBlocked(false);
        throw new Error(data.message ?? "No se pudo iniciar sesión");
      }

      // Set session on the browser client using tokens from server
      if (data.access_token && data.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
      }

      // Send 2FA code
      const twoFaResponse = await fetch("/api/auth/send-2fa-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: data.user_id, email: email.trim() }),
      });

      if (!twoFaResponse.ok) {
        router.replace(nextPath || "/clinic");
        router.refresh();
        return;
      }

      const params = new URLSearchParams({
        uid: data.user_id!,
        email: email.trim(),
        next: nextPath || "/clinic",
      });
      router.replace(`/verify-2fa?${params.toString()}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {blocked ? (
        <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-center">
          <p className="text-sm font-medium text-red-800">Cuenta bloqueada temporalmente</p>
          <p className="mt-1 text-sm text-red-700">
            Demasiados intentos fallidos. Prueba de nuevo en {blockedMinutes} minuto{blockedMinutes > 1 ? "s" : ""}.
          </p>
        </div>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-foreground">Email</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => { setEmail(event.target.value); setBlocked(false); }}
          className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
          placeholder="tu@clinica.com"
          required
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-foreground">Contraseña</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
          placeholder="Tu contraseña"
          required
        />
      </label>

      {errorMessage && !blocked ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <div className="text-right">
        <Link href="/forgot-password" className="text-sm font-medium text-primary underline">
          ¿Has olvidado tu contraseña?
        </Link>
      </div>

      <button
        type="submit"
        disabled={submitting || blocked}
        className="w-full rounded-[10px] bg-primary px-5 py-3 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Entrando..." : "Entrar"}
      </button>

      <p className="text-center text-sm text-muted">
        ¿Eres nuevo?{" "}
        <Link href="/register" className="font-medium text-primary underline">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}
