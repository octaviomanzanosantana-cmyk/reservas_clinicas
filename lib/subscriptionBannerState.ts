/**
 * Sprint 3 — Banner de suscripción
 * Helper puro que calcula el estado del banner según los datos de la clínica.
 *
 * Pure function, sin side effects, sin acceso a Supabase.
 * El componente Server llama a este helper con datos ya leídos.
 *
 * Reglas clave:
 * - Pilots (is_pilot=true) SIEMPRE devuelven null. Antes que cualquier otro check.
 * - email_unverified no entra al panel → no se contempla aquí.
 * - active normal sin renovación próxima → null (sin banner).
 * - free puro → null. El estado "Free con exceso" va en Sprint 3.1.
 */

import { getMonthlyAmountCents } from './planPricing';

export type SubscriptionBannerState =
  | { kind: 'trial_early'; daysLeft: number }
  | { kind: 'trial_warning'; daysLeft: number }
  | { kind: 'trial_last_day' }
  | { kind: 'active_renewal_soon'; renewalDate: Date; amountCents: number }
  | { kind: 'past_due' }
  | { kind: 'canceled_pending'; downgradeDate: Date }
  | null;

export type ClinicSubscriptionInfo = {
  subscription_status: string | null;
  is_pilot: boolean | null;
  trial_ends_at: string | null;
  plan_expires_at: string | null;
  stripe_subscription_id: string | null;
  plan: string | null;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_HOUR = 1000 * 60 * 60;

function diffDays(future: Date, now: Date): number {
  return Math.ceil((future.getTime() - now.getTime()) / MS_PER_DAY);
}

function diffHours(future: Date, now: Date): number {
  return (future.getTime() - now.getTime()) / MS_PER_HOUR;
}

export function calculateBannerState(
  clinic: ClinicSubscriptionInfo,
  now: Date = new Date()
): SubscriptionBannerState {
  // 1. Pilots SIEMPRE excluidos. Primer check.
  if (clinic.is_pilot === true) return null;

  const status = clinic.subscription_status;

  // 2. email_unverified, free, null o desconocidos → sin banner
  if (!status || status === 'email_unverified' || status === 'free') {
    return null;
  }

  // 3. TRIAL — 3 sub-estados según tiempo restante
  if (status === 'trial') {
    if (!clinic.trial_ends_at) return null;
    const trialEnd = new Date(clinic.trial_ends_at);
    const hoursLeft = diffHours(trialEnd, now);
    const daysLeft = diffDays(trialEnd, now);

    // trial_last_day: <24h restantes O ya venció pero el cron no ha procesado.
    // Cubre el lag del cron daily-lifecycle hasta su próximo run.
    if (hoursLeft < 24) {
      return { kind: 'trial_last_day' };
    }
    // trial_warning: 1-5 días restantes (>24h ya garantizado arriba)
    if (daysLeft <= 5) {
      return { kind: 'trial_warning', daysLeft };
    }
    // trial_early: >5 días
    return { kind: 'trial_early', daysLeft };
  }

  // 4. ACTIVE — solo banner si renovación próxima Y es paying real
  if (status === 'active') {
    if (!clinic.stripe_subscription_id) return null; // pilots ya filtrados, defensivo extra
    if (!clinic.plan_expires_at) return null;

    const expiresAt = new Date(clinic.plan_expires_at);
    const daysToRenewal = diffDays(expiresAt, now);

    if (daysToRenewal <= 3 && daysToRenewal >= 0) {
      return {
        kind: 'active_renewal_soon',
        renewalDate: expiresAt,
        amountCents: getMonthlyAmountCents(clinic.plan),
      };
    }
    return null; // active normal: sin banner
  }

  // 5. PAST_DUE — siempre banner rojo no cerrable
  if (status === 'past_due') {
    return { kind: 'past_due' };
  }

  // 6. CANCELED — banner solo si periodo aún vigente
  if (status === 'canceled') {
    if (!clinic.plan_expires_at) return null;
    const expiresAt = new Date(clinic.plan_expires_at);
    if (expiresAt.getTime() > now.getTime()) {
      return { kind: 'canceled_pending', downgradeDate: expiresAt };
    }
    // Periodo ya vencido → la clínica debería estar en 'free' (lag del cron).
    // No mostrar banner; el siguiente run del cron la moverá a free.
    return null;
  }

  // Estado desconocido → no banner
  return null;
}
