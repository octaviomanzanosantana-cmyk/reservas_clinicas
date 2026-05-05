"use client";

import { CancelSubscriptionModal } from "@/components/billing/CancelSubscriptionModal";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type SubscriptionActionsProps = {
  subscriptionStatus: string;
  stripeSubscriptionId: string | null;
  planExpiresAt: string | null;
  canceledAt: string | null;
  isPilot: boolean;
};

type ReactivateApiResponse = {
  ok?: boolean;
  already_active?: boolean;
  plan_expires_at?: string | null;
  error?: string;
};

/**
 * Sprint 6 — Acciones de gestión de suscripción.
 *
 * Renderiza condicionalmente:
 *  - "Cancelar suscripción" si active|trial + Stripe + !pilot
 *  - "Reactivar suscripción" si canceled + Stripe + !pilot + periodo no expirado
 *
 * Las dos acciones requieren stripe_subscription_id porque el flujo
 * pasa por subscriptions.update; pilots no entran a estos botones
 * (su gestión es manual).
 */
export function SubscriptionActions({
  subscriptionStatus,
  stripeSubscriptionId,
  planExpiresAt,
  canceledAt: _canceledAt,
  isPilot,
}: SubscriptionActionsProps) {
  void _canceledAt; // reservado para futura UI; webhook lo gestiona
  const router = useRouter();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [reactivating, setReactivating] = useState(false);

  if (isPilot) return null;
  if (!stripeSubscriptionId) return null;

  const periodActive =
    !!planExpiresAt && new Date(planExpiresAt).getTime() > Date.now();

  const showCancel =
    subscriptionStatus === "active" || subscriptionStatus === "trial";
  const showReactivate = subscriptionStatus === "canceled" && periodActive;

  if (!showCancel && !showReactivate) return null;

  const handleReactivate = async () => {
    if (reactivating) return;
    setReactivating(true);
    try {
      const response = await fetch("/api/billing/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await response.json()) as ReactivateApiResponse;

      if (!response.ok) {
        throw new Error(data?.error || "Error desconocido");
      }

      if (data.already_active) {
        toast.info("Tu suscripción ya estaba activa");
      } else {
        toast.success("Suscripción reactivada correctamente");
      }
      router.refresh();
    } catch (error) {
      toast.error("No se pudo reactivar", {
        description:
          error instanceof Error
            ? error.message
            : "Inténtalo de nuevo en unos segundos.",
      });
    } finally {
      setReactivating(false);
    }
  };

  return (
    <>
      <div className="mt-5">
        {showCancel ? (
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="inline-flex rounded-[10px] border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 transition-colors duration-150 hover:border-red-300 hover:bg-red-50"
          >
            Cancelar suscripción
          </button>
        ) : null}

        {showReactivate ? (
          <button
            type="button"
            onClick={handleReactivate}
            disabled={reactivating}
            className="inline-flex rounded-[10px] bg-primary px-5 py-2.5 font-heading text-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reactivating ? "Reactivando..." : "Reactivar suscripción"}
          </button>
        ) : null}
      </div>

      {showCancel ? (
        <CancelSubscriptionModal
          open={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          planExpiresAt={planExpiresAt}
          onSuccess={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
