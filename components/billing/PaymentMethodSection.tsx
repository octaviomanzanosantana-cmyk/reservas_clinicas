"use client";

import { PlanIntervalSelector, type PlanInterval } from "./PlanIntervalSelector";
import { useState } from "react";

type PaymentMethodSectionProps = {
  hasSubscription: boolean;
  hasFiscalData: boolean;
  planExpiresAt: string | null;
  checkoutStatus: "success" | "cancel" | null;
};

type ApiResponse = {
  url?: string;
  error?: string;
  missingTaxData?: boolean;
};

function formatDateES(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Madrid",
    });
  } catch {
    return null;
  }
}

export function PaymentMethodSection({
  hasSubscription,
  hasFiscalData,
  planExpiresAt,
  checkoutStatus,
}: PaymentMethodSectionProps) {
  const [interval, setInterval] = useState<PlanInterval>("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nextRenewalDate = formatDateES(planExpiresAt);

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/billing/setup-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        setErrorMessage(data.error ?? "No se pudo iniciar el checkout.");
        setSubmitting(false);
        return;
      }

      if (!data.url) {
        setErrorMessage("Stripe no devolvió URL de checkout.");
        setSubmitting(false);
        return;
      }

      // Redirect a Stripe Checkout. NO reseteamos submitting porque
      // la página está a punto de navegar.
      window.location.href = data.url;
    } catch {
      setErrorMessage("Error de conexión. Inténtalo de nuevo.");
      setSubmitting(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Caso 1: ya tiene suscripción activa
  // ─────────────────────────────────────────────────────────
  if (hasSubscription) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
            ✓
          </span>
          <p className="text-sm font-medium text-foreground">
            Tu suscripción está activa
          </p>
        </div>
        {nextRenewalDate ? (
          <p className="text-sm text-muted">
            Próxima renovación: {nextRenewalDate}
          </p>
        ) : null}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Caso 2: falta tax_data
  // ─────────────────────────────────────────────────────────
  if (!hasFiscalData) {
    return (
      <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-4">
        <p className="text-sm font-semibold text-amber-900">
          Completa tus datos fiscales antes de añadir un método de pago
        </p>
        <p className="mt-1 text-sm text-amber-800">
          Los necesitamos para poder emitir tus facturas correctamente.
        </p>
        <a
          href="/mi-plan/datos-fiscales"
          className="mt-4 inline-flex rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover"
        >
          Completar datos fiscales
        </a>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Caso 3: tax_data completo y sin suscripción → flujo Checkout
  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {checkoutStatus === "success" ? (
        <div className="flex items-start gap-3 rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M2.5 6L5 8.5L9.5 3.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">
              Tarjeta añadida correctamente
            </p>
            <p className="mt-1 text-sm text-foreground">
              Recibirás un email de confirmación en los próximos minutos. Tu
              plan se activará automáticamente al finalizar la prueba.
            </p>
          </div>
        </div>
      ) : null}

      {checkoutStatus === "cancel" ? (
        <div className="flex items-start gap-3 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white text-[11px] font-bold">
            i
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Has cancelado el proceso
            </p>
            <p className="mt-1 text-sm text-amber-800">
              No se ha guardado ninguna tarjeta. Puedes intentarlo de nuevo
              cuando quieras.
            </p>
          </div>
        </div>
      ) : null}

      <div>
        <p className="text-sm text-muted">
          Elige la periodicidad de tu suscripción. No se cobrará nada hasta
          que termine tu prueba gratuita.
        </p>
      </div>

      <PlanIntervalSelector
        value={interval}
        onChange={setInterval}
        disabled={submitting}
      />

      {errorMessage ? (
        <div className="rounded-[10px] border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-[10px] bg-primary px-5 py-3 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Redirigiendo a Stripe..." : "Añadir método de pago"}
      </button>
    </div>
  );
}
