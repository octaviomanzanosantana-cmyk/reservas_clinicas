-- =============================================================================
-- Sprint Comercial Chat 3 · Fase 1
-- Fecha: 2026-04-22
-- Autor: Octavio Manzano
--
-- Añade tracking idempotente del cron de trial y flag de cliente piloto:
-- - last_trial_email_sent: avanza unidireccionalmente NULL → 5d → 24h → expired
-- - is_pilot: excluye a las clínicas piloto de trial, cobro y dunning
--
-- Y marca las 2 clínicas piloto existentes (miriamlorenzo, symbios-psicologia).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BLOQUE 1: columnas nuevas en clinics
-- -----------------------------------------------------------------------------
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS last_trial_email_sent TEXT
    CHECK (last_trial_email_sent IN ('5d', '24h', 'expired')),
  ADD COLUMN IF NOT EXISTS is_pilot BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN clinics.last_trial_email_sent IS
  'Tracking idempotente del cron de trial: NULL, 5d, 24h, expired. Avanza unidireccionalmente.';

COMMENT ON COLUMN clinics.is_pilot IS
  'Cliente piloto permanente (Starter completo sin cobro). Excluido de todos los flujos de trial, cobro y dunning.';

-- -----------------------------------------------------------------------------
-- BLOQUE 2: marcar clínicas piloto existentes
-- -----------------------------------------------------------------------------
UPDATE clinics
SET is_pilot = true
WHERE slug IN ('miriamlorenzo', 'symbios-psicologia');

-- =============================================================================
-- Fin migración
-- =============================================================================
