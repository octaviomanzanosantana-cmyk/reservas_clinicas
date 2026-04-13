"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("uid") ?? "";
  const email = searchParams.get("email") ?? "";
  const nextPath = searchParams.get("next") ?? "/clinic";

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/send-2fa-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, email }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; message?: string };

      if (!response.ok) {
        setErrorMessage(data.message ?? "No se pudo reenviar el código");
        return;
      }

      setCooldown(60);
      setCode("");
    } catch {
      setErrorMessage("Error al reenviar el código");
    } finally {
      setResending(false);
    }
  }, [cooldown, email, resending, userId]);

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code.trim() || code.trim().length !== 6) {
      setErrorMessage("Introduce el código de 6 dígitos");
      return;
    }

    setVerifying(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/verify-2fa-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, code: code.trim() }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; message?: string };

      if (!response.ok || !data.ok) {
        setErrorMessage(data.message ?? "Código incorrecto");
        if (data.error === "max_attempts" || data.error === "expired" || data.error === "no_code") {
          setCode("");
        }
        return;
      }

      // Store 2FA verification in sessionStorage
      sessionStorage.setItem("2fa_verified", Date.now().toString());
      router.replace(nextPath);
      router.refresh();
    } catch {
      setErrorMessage("Error al verificar el código");
    } finally {
      setVerifying(false);
    }
  };

  if (!userId || !email) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 md:px-6 md:py-12">
        <div className="mx-auto max-w-md text-center">
          <p className="text-sm text-muted">Sesión no válida. Vuelve a iniciar sesión.</p>
          <a href="/login" className="mt-4 inline-block text-sm font-medium text-primary underline">
            Ir al login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-md">
        <section className="overflow-hidden rounded-[14px] border-[0.5px] border-border bg-card">
          <div className="px-6 py-8 md:px-8 md:py-9">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
              Verificación
            </p>
            <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight text-foreground">
              Código de acceso
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted">
              Hemos enviado un código de verificación a{" "}
              <strong className="text-foreground">{maskEmail(email)}</strong>
            </p>

            <form onSubmit={handleVerify} className="mt-8 space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-foreground">Código de 6 dígitos</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-2 w-full rounded-[10px] border-[1.5px] border-border bg-white px-4 py-3 text-center text-2xl font-semibold tracking-[0.3em] text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:shadow-[0_0_0_3px_rgba(14,158,130,0.12)]"
                  placeholder="000000"
                  autoFocus
                />
              </label>

              <p className="text-xs text-muted text-center">Este código es válido durante 10 minutos.</p>

              {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

              <button
                type="submit"
                disabled={verifying || code.length !== 6}
                className="w-full rounded-[10px] bg-primary px-5 py-3 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifying ? "Verificando..." : "Verificar"}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={cooldown > 0 || resending}
                  className="text-sm font-medium text-primary underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
                >
                  {cooldown > 0 ? `Puedes reenviar en (${cooldown}s)` : resending ? "Reenviando..." : "Reenviar código"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Verify2FAPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto max-w-md text-center text-sm text-muted">Cargando...</div>
      </main>
    }>
      <VerifyContent />
    </Suspense>
  );
}
