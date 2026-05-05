"use client";

import {
  CANCEL_REASONS,
  type CancelReason,
} from "@/lib/billing/cancelReasons";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type CancelSubscriptionModalProps = {
  open: boolean;
  onClose: () => void;
  /** ISO string del fin de periodo (clinic.plan_expires_at). */
  planExpiresAt: string | null;
  /** Callback tras cancelación exitosa (idempotente o nueva). */
  onSuccess: () => void;
};

type CancelApiResponse = {
  ok?: boolean;
  already_canceled?: boolean;
  plan_expires_at?: string | null;
  error?: string;
};

const REASON_DETAIL_MAX = 1000;

function formatDateES(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const formatted = new Date(iso).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Madrid",
    });
    return formatted;
  } catch {
    return null;
  }
}

export function CancelSubscriptionModal({
  open,
  onClose,
  planExpiresAt,
  onSuccess,
}: CancelSubscriptionModalProps) {
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [reasonDetail, setReasonDetail] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset al abrir: limpia selección anterior si el modal se reabre.
  useEffect(() => {
    if (open) {
      setReason(null);
      setReasonDetail("");
      setLoading(false);
    }
  }, [open]);

  // Escape cierra el modal salvo durante request.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, loading, onClose]);

  if (!open) return null;

  const formattedEndDate = formatDateES(planExpiresAt);

  const detailRequiredMissing =
    reason === "other" && reasonDetail.trim() === "";
  const confirmDisabled = !reason || detailRequiredMissing || loading;

  const handleReasonChange = (next: CancelReason) => {
    if (loading) return;
    setReason(next);
    if (next !== "other") {
      setReasonDetail("");
    }
  };

  const handleBackdropClick = () => {
    if (!loading) onClose();
  };

  const handleConfirm = async () => {
    if (confirmDisabled || !reason) return;
    setLoading(true);
    try {
      const response = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          reason_detail:
            reason === "other" ? reasonDetail.trim() : null,
        }),
      });

      const data = (await response.json()) as CancelApiResponse;

      if (!response.ok) {
        throw new Error(data?.error || "Error desconocido");
      }

      if (data.already_canceled) {
        toast.info("Tu suscripción ya estaba cancelada");
      } else {
        toast.success("Cancelación confirmada", {
          description:
            "Recibirás un email de confirmación en los próximos minutos.",
        });
      }

      onSuccess();
      onClose();
    } catch (error) {
      toast.error("No se pudo cancelar", {
        description:
          error instanceof Error
            ? error.message
            : "Inténtalo de nuevo en unos segundos.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-subscription-title"
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-lg md:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <h2
          id="cancel-subscription-title"
          className="font-heading text-lg font-semibold text-foreground"
        >
          ¿Por qué cancelas tu suscripción?
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Tu feedback nos ayuda a mejorar Appoclick.
        </p>

        {/* Body — radios */}
        <fieldset className="mt-5 space-y-2" disabled={loading}>
          <legend className="sr-only">Motivo de cancelación</legend>
          {CANCEL_REASONS.map((option) => {
            const isSelected = reason === option.value;
            return (
              <label
                key={option.value}
                className={[
                  "flex cursor-pointer items-center gap-3 rounded-[10px] border-[1.5px] px-4 py-3 transition-all",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-white hover:border-primary/40 hover:bg-gray-50",
                  loading ? "cursor-not-allowed opacity-60" : "",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => handleReasonChange(option.value)}
                  disabled={loading}
                  className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
                />
                <span className="text-sm text-foreground">
                  {option.label}
                </span>
              </label>
            );
          })}
        </fieldset>

        {/* Textarea condicional para 'other' */}
        {reason === "other" ? (
          <div className="mt-4">
            <textarea
              value={reasonDetail}
              onChange={(e) =>
                setReasonDetail(e.target.value.slice(0, REASON_DETAIL_MAX))
              }
              disabled={loading}
              rows={3}
              maxLength={REASON_DETAIL_MAX}
              placeholder="Cuéntanos brevemente (opcional para nosotros, importante para mejorar)"
              className="w-full rounded-[10px] border-[1.5px] border-border bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-1 text-right text-xs text-muted">
              {reasonDetail.length}/{REASON_DETAIL_MAX}
            </p>
          </div>
        ) : null}

        {/* Mensaje informativo */}
        {formattedEndDate ? (
          <p className="mt-5 rounded-[10px] bg-gray-50 px-4 py-3 text-sm leading-6 text-muted">
            Tu suscripción seguirá activa hasta el{" "}
            <span className="font-semibold text-foreground">
              {formattedEndDate}
            </span>
            . A partir de esa fecha pasarás al plan Free. Tus datos se conservan.
          </p>
        ) : null}

        {/* Footer */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-900 transition-colors duration-150 hover:bg-gray-50"
          >
            Me lo pienso
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className="rounded-[10px] bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Cancelando..." : "Confirmar cancelación"}
          </button>
        </div>
      </div>
    </div>
  );
}
