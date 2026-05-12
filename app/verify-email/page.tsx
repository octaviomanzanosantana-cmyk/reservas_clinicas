"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type ErrorCode =
  | "no_clinic_provisioned"
  | "invalid_link"
  | "verify_failed"
  | "provisioning_failed"
  | "unknown";

function normalizeErrorCode(raw: string | null): ErrorCode | null {
  if (!raw) return null;
  switch (raw) {
    case "no_clinic_provisioned":
    case "invalid_link":
    case "verify_failed":
    case "provisioning_failed":
      return raw;
    default:
      // /auth/confirm también emite ?error=<verifyError.message> en algunos
      // casos (mensaje crudo de Supabase). Cae en "unknown" → copy genérico.
      return "unknown";
  }
}

const ERROR_COPY: Record<ErrorCode, { title: string; message: string }> = {
  no_clinic_provisioned: {
    title: "Tu panel no se creó",
    message:
      "Tu email se confirmó pero la creación de tu panel no se completó. Reenvía el email de verificación para terminar la activación.",
  },
  invalid_link: {
    title: "Enlace no válido",
    message:
      "El enlace de confirmación no es válido. Solicita un nuevo email para volver a intentarlo.",
  },
  verify_failed: {
    title: "No pudimos verificar tu email",
    message:
      "El enlace puede haber expirado o haberse usado ya. Reenvía el email de verificación para obtener uno nuevo.",
  },
  provisioning_failed: {
    title: "No pudimos crear tu panel",
    message:
      "Tu email se confirmó pero no pudimos crear tu panel automáticamente. Reenvía el email de verificación o contacta soporte si el problema persiste.",
  },
  unknown: {
    title: "Algo no ha ido bien",
    message:
      "Ha ocurrido un error procesando tu verificación. Reenvía el email para volver a intentarlo.",
  },
};

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorCode = normalizeErrorCode(searchParams.get("error"));
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (!data.user) {
        router.replace("/login");
        return;
      }
      // Con errorCode en URL, mostramos el mensaje aunque el email esté
      // confirmado (rompe el bucle /clinic→/verify-email→/clinic cuando
      // el provisioning quedó incompleto). Sin errorCode: panel.
      if (!errorCode && data.user.email_confirmed_at) {
        router.replace("/clinic");
        return;
      }
      setEmail(data.user.email ?? null);
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [supabase, router, errorCode]);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setMessage(null);
    setError(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (resendError) throw new Error(resendError.message);
      setMessage("Email de verificación reenviado. Revisa tu bandeja.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reenviar");
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  if (checking) {
    return null;
  }

  const errorCopy = errorCode ? ERROR_COPY[errorCode] : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
        <div className="rounded-[14px] border-[0.5px] border-border bg-card p-8">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
            {errorCopy ? errorCopy.title : "Verifica tu email"}
          </h1>
          {errorCopy ? (
            <p className="mt-3 text-sm text-foreground">{errorCopy.message}</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-foreground">
                Hemos enviado un enlace de verificación a{" "}
                {email ? <strong>{email}</strong> : "tu correo"}. Haz clic en él para activar tu cuenta
                y acceder al panel.
              </p>
              <p className="mt-2 text-sm text-muted">
                Si no ves el email, revisa la carpeta de spam o promociones. Puede tardar un par de
                minutos.
              </p>
            </>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resending}
              className="rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resending ? "Reenviando..." : "Reenviar email de verificación"}
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-[10px] border-[0.5px] border-border px-4 py-2.5 font-heading text-sm font-semibold text-muted transition-colors hover:text-foreground"
            >
              Cerrar sesión
            </button>
          </div>

          {message ? <p className="mt-4 text-sm text-primary">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
