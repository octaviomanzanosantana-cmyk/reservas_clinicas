/**
 * Razones de cancelación de suscripción.
 * Sincronizado con CHECK constraint en tabla subscription_cancellations
 * (ver supabase/migrations/20260422170641_sprint_comercial_fase_1.sql).
 *
 * IMPORTANTE: si se modifica este array, actualizar también el CHECK
 * constraint en BD vía nueva migration.
 */

export type CancelReason =
  | "price"
  | "not_using"
  | "alternative"
  | "business_change"
  | "other";

export interface CancelReasonOption {
  value: CancelReason;
  label: string;
}

export const CANCEL_REASONS: CancelReasonOption[] = [
  { value: "price", label: "Precio" },
  { value: "not_using", label: "No lo uso" },
  { value: "alternative", label: "Encontré una alternativa" },
  { value: "business_change", label: "Cambio en mi negocio" },
  { value: "other", label: "Otro motivo" },
];

/**
 * Type guard para validar que un string es una CancelReason válida.
 * Útil en endpoints que reciben el valor del body.
 */
export function isValidCancelReason(value: unknown): value is CancelReason {
  return (
    typeof value === "string" &&
    CANCEL_REASONS.some((r) => r.value === value)
  );
}
