/**
 * Importes de planes en céntimos. Fuente de verdad para UI informativa
 * (banner de suscripción, /mi-plan, etc.).
 *
 * Estos valores deben coincidir con los precios configurados en Stripe.
 * En el cobro real Stripe manda; esta constante es solo para mostrar
 * al usuario antes del cobro.
 */

export type PlanKey = 'starter' | 'pro';
export type Interval = 'monthly' | 'yearly';

export const PLAN_AMOUNT_CENTS: Record<PlanKey, Record<Interval, number>> = {
  starter: {
    monthly: 1900,   // 19,00 €
    yearly: 19000,   // 190,00 €
  },
  pro: {
    monthly: 3900,   // 39,00 € (próximamente)
    yearly: 39000,   // 390,00 €
  },
};

export function getMonthlyAmountCents(plan: string | null | undefined): number {
  if (plan === 'starter' || plan === 'pro') {
    return PLAN_AMOUNT_CENTS[plan].monthly;
  }
  // Fallback seguro: precio Starter. Cubre 'free', null, y casos no previstos.
  return PLAN_AMOUNT_CENTS.starter.monthly;
}
