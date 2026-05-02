import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBannerState, type ClinicSubscriptionInfo } from './subscriptionBannerState';

const NOW = new Date('2026-05-10T12:00:00Z');

function daysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}
function hoursFromNow(hours: number): string {
  return new Date(NOW.getTime() + hours * 60 * 60 * 1000).toISOString();
}

const baseClinic: ClinicSubscriptionInfo = {
  subscription_status: 'free',
  is_pilot: false,
  trial_ends_at: null,
  plan_expires_at: null,
  stripe_subscription_id: null,
  plan: 'free',
};

// === 6 estados positivos ===

test('trial_early: 10 días restantes', () => {
  const result = calculateBannerState({
    ...baseClinic,
    subscription_status: 'trial',
    trial_ends_at: daysFromNow(10),
    plan: 'starter',
  }, NOW);
  assert.deepEqual(result, { kind: 'trial_early', daysLeft: 10 });
});

test('trial_warning: 3 días restantes', () => {
  const result = calculateBannerState({
    ...baseClinic,
    subscription_status: 'trial',
    trial_ends_at: daysFromNow(3),
    plan: 'starter',
  }, NOW);
  assert.deepEqual(result, { kind: 'trial_warning', daysLeft: 3 });
});

test('trial_last_day: 6 horas restantes', () => {
  const result = calculateBannerState({
    ...baseClinic,
    subscription_status: 'trial',
    trial_ends_at: hoursFromNow(6),
    plan: 'starter',
  }, NOW);
  assert.deepEqual(result, { kind: 'trial_last_day' });
});

test('trial_last_day: trial vencido pero status=trial (lag cron)', () => {
  const result = calculateBannerState({
    ...baseClinic,
    subscription_status: 'trial',
    trial_ends_at: hoursFromNow(-3),
    plan: 'starter',
  }, NOW);
  assert.deepEqual(result, { kind: 'trial_last_day' });
});

test('active_renewal_soon: 2 días para renovación, plan starter', () => {
  const result = calculateBannerState({
    ...baseClinic,
    subscription_status: 'active',
    stripe_subscription_id: 'sub_test_123',
    plan_expires_at: daysFromNow(2),
    plan: 'starter',
  }, NOW);
  assert.equal(result?.kind, 'active_renewal_soon');
  if (result?.kind === 'active_renewal_soon') {
    assert.equal(result.amountCents, 1900);
  }
});

test('past_due: siempre banner', () => {
  const result = calculateBannerState({
    ...baseClinic,
    subscription_status: 'past_due',
  }, NOW);
  assert.deepEqual(result, { kind: 'past_due' });
});

test('canceled_pending: periodo aún vigente', () => {
  const result = calculateBannerState({
    ...baseClinic,
    subscription_status: 'canceled',
    plan_expires_at: daysFromNow(15),
  }, NOW);
  assert.equal(result?.kind, 'canceled_pending');
});

// === 7 exclusiones críticas ===

test('EXCL: pilot con active → null', () => {
  const result = calculateBannerState({
    ...baseClinic,
    subscription_status: 'active',
    is_pilot: true,
    stripe_subscription_id: null,
    plan_expires_at: daysFromNow(30),
  }, NOW);
  assert.equal(result, null);
});

test('EXCL: pilot con trial → null', () => {
  const result = calculateBannerState({
    ...baseClinic,
    subscription_status: 'trial',
    is_pilot: true,
    trial_ends_at: daysFromNow(2),
  }, NOW);
  assert.equal(result, null);
});

test('EXCL: free puro → null', () => {
  assert.equal(calculateBannerState(baseClinic, NOW), null);
});

test('EXCL: active normal lejos de renovación → null', () => {
  const result = calculateBannerState({
    ...baseClinic,
    subscription_status: 'active',
    stripe_subscription_id: 'sub_test_123',
    plan_expires_at: daysFromNow(20),
    plan: 'starter',
  }, NOW);
  assert.equal(result, null);
});

test('EXCL: active sin stripe_subscription_id → null (defensivo)', () => {
  const result = calculateBannerState({
    ...baseClinic,
    subscription_status: 'active',
    stripe_subscription_id: null,
    plan_expires_at: daysFromNow(2),
    plan: 'starter',
  }, NOW);
  assert.equal(result, null);
});

test('EXCL: canceled con periodo ya vencido → null', () => {
  const result = calculateBannerState({
    ...baseClinic,
    subscription_status: 'canceled',
    plan_expires_at: daysFromNow(-5),
  }, NOW);
  assert.equal(result, null);
});

test('EXCL: email_unverified → null', () => {
  const result = calculateBannerState({
    ...baseClinic,
    subscription_status: 'email_unverified',
  }, NOW);
  assert.equal(result, null);
});
