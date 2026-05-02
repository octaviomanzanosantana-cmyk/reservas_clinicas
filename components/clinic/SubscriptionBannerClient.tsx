"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Info, AlertTriangle, CreditCard, AlertOctagon, Clock, type LucideIcon } from "lucide-react";
import type { SubscriptionBannerState } from "@/lib/subscriptionBannerState";

const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type StateStyle = {
  background: string;
  border: string;
  text: string;
};

const STYLES: Record<NonNullable<SubscriptionBannerState>["kind"], StateStyle> = {
  trial_early:         { background: "#E6F7F3", border: "#A3D9CC", text: "#0B7D68" },
  trial_warning:       { background: "#FEF3C7", border: "#FDE68A", text: "#92400E" },
  trial_last_day:      { background: "#FCD34D", border: "#F59E0B", text: "#78350F" },
  active_renewal_soon: { background: "#F3F4F6", border: "#E5E7EB", text: "#374151" },
  past_due:            { background: "#FEE2E2", border: "#FECACA", text: "#991B1B" },
  canceled_pending:    { background: "#F3F4F6", border: "#E5E7EB", text: "#374151" },
};

const ICONS: Record<NonNullable<SubscriptionBannerState>["kind"], LucideIcon> = {
  trial_early:         Info,
  trial_warning:       AlertTriangle,
  trial_last_day:      AlertTriangle,
  active_renewal_soon: CreditCard,
  past_due:            AlertOctagon,
  canceled_pending:    Clock,
};

const NON_DISMISSIBLE: Array<NonNullable<SubscriptionBannerState>["kind"]> = [
  "trial_last_day",
  "past_due",
];

const TIMED_DISMISS: Array<NonNullable<SubscriptionBannerState>["kind"]> = [
  "trial_early",
  "trial_warning",
];

type Props = {
  state: NonNullable<SubscriptionBannerState>;
};

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function getDismissKey(state: NonNullable<SubscriptionBannerState>): string {
  switch (state.kind) {
    case "trial_early":
    case "trial_warning":
      // Las dos usan trial_ends_at, pero el helper solo nos da daysLeft.
      // Para diferenciarlas y que la key cambie cuando cambie el día,
      // incluimos daysLeft en la key. No es perfecto (la key cambia cada
      // día y reaparece el banner) pero es aceptable: el banner debería
      // re-llamar la atención cada día nuevo en trial_warning.
      return `subscription_banner_dismissed_${state.kind}_d${state.daysLeft}`;
    case "active_renewal_soon":
      return `subscription_banner_dismissed_${state.kind}_${state.renewalDate.toISOString()}`;
    case "canceled_pending":
      return `subscription_banner_dismissed_${state.kind}_${state.downgradeDate.toISOString()}`;
    default:
      return "";
  }
}

function getMessage(state: NonNullable<SubscriptionBannerState>): string {
  switch (state.kind) {
    case "trial_early":
      return `Prueba gratuita · ${state.daysLeft} ${state.daysLeft === 1 ? "día restante" : "días restantes"}`;
    case "trial_warning":
      return `Tu prueba acaba en ${state.daysLeft} ${state.daysLeft === 1 ? "día" : "días"}. Añade un método de pago para no perder tus datos.`;
    case "trial_last_day":
      return "Último día de prueba. Añade tu método de pago hoy para mantener el servicio.";
    case "active_renewal_soon":
      return `Próxima renovación: ${formatAmount(state.amountCents)} € el ${formatDate(state.renewalDate)}`;
    case "past_due":
      return "Pago pendiente. Actualiza tu método de pago para no perder el acceso.";
    case "canceled_pending":
      return `Tu plan cambia a Free el ${formatDate(state.downgradeDate)}. Tus datos se conservarán.`;
  }
}

function getCtaText(kind: NonNullable<SubscriptionBannerState>["kind"]): string {
  switch (kind) {
    case "trial_early":           return "Ver mi plan";
    case "trial_warning":         return "Añadir método de pago";
    case "trial_last_day":        return "Añadir método de pago";
    case "active_renewal_soon":   return "Ver mi plan";
    case "past_due":              return "Actualizar método de pago";
    case "canceled_pending":      return "Reactivar suscripción";
  }
}

export default function SubscriptionBannerClient({ state }: Props) {
  const [hidden, setHidden] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const dismissKey = getDismissKey(state);
  const isDismissible = !NON_DISMISSIBLE.includes(state.kind);
  const isTimed = TIMED_DISMISS.includes(state.kind);

  // Comprueba localStorage al montar (post-hydration, evita mismatch SSR)
  useEffect(() => {
    setHydrated(true);
    if (!isDismissible || !dismissKey) return;

    try {
      const raw = localStorage.getItem(dismissKey);
      if (!raw) return;

      if (isTimed) {
        // Esperamos { dismissedAt: ISO }
        const parsed = JSON.parse(raw) as { dismissedAt?: string };
        if (parsed.dismissedAt) {
          const dismissedAt = new Date(parsed.dismissedAt).getTime();
          if (Date.now() - dismissedAt < DISMISS_TTL_MS) {
            setHidden(true);
          } else {
            // TTL expirado, limpiar
            localStorage.removeItem(dismissKey);
          }
        }
      } else {
        // Esperamos { dismissed: true } permanente (mientras la key no cambie)
        const parsed = JSON.parse(raw) as { dismissed?: boolean };
        if (parsed.dismissed === true) {
          setHidden(true);
        }
      }
    } catch {
      // localStorage corrupto o inaccesible: no ocultar (mostrar banner es fail-safe)
    }
  }, [dismissKey, isDismissible, isTimed]);

  function handleDismiss() {
    if (!isDismissible || !dismissKey) return;
    try {
      const payload = isTimed
        ? { dismissedAt: new Date().toISOString() }
        : { dismissed: true };
      localStorage.setItem(dismissKey, JSON.stringify(payload));
    } catch {
      // Si localStorage falla, simplemente ocultamos en memoria
    }
    setHidden(true);
  }

  // Antes de hidratar no renderizamos para evitar flash si está cerrado
  if (!hydrated) return null;
  if (hidden) return null;

  const style = STYLES[state.kind];
  const message = getMessage(state);
  const ctaText = getCtaText(state.kind);
  const Icon = ICONS[state.kind];

  return (
    <div
      role={state.kind === "past_due" ? "alert" : "status"}
      style={{
        backgroundColor: style.background,
        borderColor: style.border,
        color: style.text,
      }}
      className="rounded-[10px] border-[0.5px] px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3 mb-4"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Icon size={16} aria-hidden="true" className="shrink-0" />
        <p className="min-w-0">{message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/mi-plan"
          style={{ color: style.text }}
          className="font-semibold underline underline-offset-2 hover:no-underline"
        >
          {ctaText}
        </Link>
        {isDismissible && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Cerrar aviso"
            style={{ color: style.text }}
            className="ml-1 px-2 py-1 rounded hover:bg-black/5 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
