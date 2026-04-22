-- =============================================================================
-- Sprint Comercial · Fase 1
-- Fecha: 2026-04-22
-- Autor: Octavio Manzano
--
-- Añade estructura de base de datos para gestión de suscripciones SaaS:
-- - Columnas nuevas en clinics: subscription_status, trial_ends_at, canceled_at,
--   pending_plan_change, pending_plan_change_at, holded_contact_id
-- - Tabla stripe_events_processed (idempotencia de webhooks)
-- - Tabla invoices (facturas emitidas)
-- - Tabla tax_data (datos fiscales del cliente)
-- - Tabla subscription_cancellations (feedback de cancelaciones)
--
-- Decisiones arquitectónicas clave:
-- - subscription_status es ortogonal a plan: plan='starter' + status='trial' es válido
-- - Trial se gestiona 100% local (trial_ends_at en BD), Stripe solo entra al añadir tarjeta
-- - Miriam Lorenzo y Symbios Psicología marcadas como 'active' (pilotos sin cobro)
-- - Distinguir "cliente activo" de "cliente paying" usando stripe_subscription_id IS NOT NULL
--
-- Este archivo documenta el SQL ya aplicado manualmente en producción el 22/04/2026.
-- NO ejecutar con supabase db push si la BD remota ya lo tiene aplicado.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- BLOQUE 1: columnas nuevas en clinics
-- -----------------------------------------------------------------------------
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS subscription_status TEXT
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'free'))
    NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_plan_change TEXT
    CHECK (pending_plan_change IN ('free', 'starter', 'pro', 'business', 'enterprise')),
  ADD COLUMN IF NOT EXISTS pending_plan_change_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS holded_contact_id TEXT;

COMMENT ON COLUMN clinics.subscription_status IS 'Estado del ciclo de vida de la suscripcion: trial, active, past_due, canceled, free';
COMMENT ON COLUMN clinics.trial_ends_at IS 'Fecha y hora en que termina el periodo de prueba local. NULL si no aplica.';
COMMENT ON COLUMN clinics.canceled_at IS 'Fecha y hora en que el usuario cancelo. NULL si nunca cancelo.';
COMMENT ON COLUMN clinics.pending_plan_change IS 'Plan destino de un downgrade pendiente. NULL si no hay downgrade programado.';
COMMENT ON COLUMN clinics.pending_plan_change_at IS 'Fecha en que se aplicara el downgrade pendiente.';
COMMENT ON COLUMN clinics.holded_contact_id IS 'ID del contacto en Holded para facturacion. Se completa al anadir metodo de pago.';

-- -----------------------------------------------------------------------------
-- BLOQUE 2: tabla stripe_events_processed (idempotencia)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stripe_events_processed (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at
  ON stripe_events_processed (processed_at);

ALTER TABLE stripe_events_processed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access"
  ON stripe_events_processed
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE stripe_events_processed IS 'Registro de eventos de Stripe procesados. Previene procesamiento duplicado (idempotencia).';
COMMENT ON COLUMN stripe_events_processed.stripe_event_id IS 'ID del evento de Stripe (evt_xxx). Clave primaria, impide duplicados.';
COMMENT ON COLUMN stripe_events_processed.event_type IS 'Tipo de evento (ej: invoice.payment_succeeded). Util para debugging.';
COMMENT ON COLUMN stripe_events_processed.processed_at IS 'Momento en que este servidor proceso el evento por primera vez.';

-- -----------------------------------------------------------------------------
-- BLOQUE 3A: tabla invoices
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  stripe_charge_id TEXT,
  holded_invoice_id TEXT,
  invoice_number TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  tax_regime TEXT CHECK (tax_regime IN ('igic_7', 'iva_21', 'isp', 'vat_intra_ue', 'none')),
  pdf_url TEXT,
  issued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_clinic_id ON invoices (clinic_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id
  ON invoices (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access invoices"
  ON invoices FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Clinic members read own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    clinic_id IN (
      SELECT cu.clinic_id FROM clinic_users cu
      WHERE cu.user_id = auth.uid()
    )
  );

COMMENT ON TABLE invoices IS 'Facturas emitidas (v1 manuales desde Holded, v2 automaticas via API).';
COMMENT ON COLUMN invoices.amount_cents IS 'Importe en centimos para evitar errores de coma flotante.';
COMMENT ON COLUMN invoices.tax_regime IS 'Regimen fiscal aplicado: igic_7 (Canarias), iva_21 (peninsular DNI), isp (empresa ES CIF), vat_intra_ue (UE), none.';

-- -----------------------------------------------------------------------------
-- BLOQUE 3B: tabla tax_data
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tax_data (
  clinic_id UUID PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  tax_id TEXT NOT NULL,
  tax_id_type TEXT NOT NULL CHECK (tax_id_type IN ('dni', 'cif', 'nie', 'vat_eu')),
  address_street TEXT,
  address_city TEXT,
  address_province TEXT,
  address_postal_code TEXT,
  address_country TEXT NOT NULL DEFAULT 'ES',
  vat_validated BOOLEAN NOT NULL DEFAULT FALSE,
  vat_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tax_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access tax_data"
  ON tax_data FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Clinic members read own tax_data"
  ON tax_data FOR SELECT
  TO authenticated
  USING (
    clinic_id IN (
      SELECT cu.clinic_id FROM clinic_users cu
      WHERE cu.user_id = auth.uid()
    )
  );

CREATE POLICY "Clinic members update own tax_data"
  ON tax_data FOR UPDATE
  TO authenticated
  USING (
    clinic_id IN (
      SELECT cu.clinic_id FROM clinic_users cu
      WHERE cu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    clinic_id IN (
      SELECT cu.clinic_id FROM clinic_users cu
      WHERE cu.user_id = auth.uid()
    )
  );

COMMENT ON TABLE tax_data IS 'Datos fiscales del cliente, requeridos al anadir metodo de pago.';
COMMENT ON COLUMN tax_data.tax_id IS 'Numero identificativo fiscal: DNI, CIF, NIE o VAT EU.';
COMMENT ON COLUMN tax_data.address_province IS 'Provincia ES. Necesaria para detectar Canarias (IGIC) vs peninsular (IVA/ISP).';
COMMENT ON COLUMN tax_data.vat_validated IS 'True si el CIF/VAT fue validado contra VIES (para inversion sujeto pasivo).';

-- -----------------------------------------------------------------------------
-- BLOQUE 3C: tabla subscription_cancellations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('price', 'not_using', 'alternative', 'business_change', 'other')),
  reason_detail TEXT,
  plan_at_cancel TEXT,
  canceled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellations_clinic_id ON subscription_cancellations (clinic_id);
CREATE INDEX IF NOT EXISTS idx_cancellations_canceled_at ON subscription_cancellations (canceled_at DESC);

ALTER TABLE subscription_cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access cancellations"
  ON subscription_cancellations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE subscription_cancellations IS 'Feedback de cancelaciones para analiticas internas. Solo service_role (no visible al usuario).';
COMMENT ON COLUMN subscription_cancellations.reason IS 'Motivo estandar elegido del dropdown en el flujo de cancelacion.';
COMMENT ON COLUMN subscription_cancellations.reason_detail IS 'Texto libre opcional si el motivo fue other.';
COMMENT ON COLUMN subscription_cancellations.plan_at_cancel IS 'Plan activo en el momento de cancelar (snapshot).';

-- -----------------------------------------------------------------------------
-- BLOQUE 4: actualización manual de clientes piloto
-- -----------------------------------------------------------------------------
-- Miriam Lorenzo y Symbios Psicología son clientes piloto permanentes:
-- plan Starter funcional sin cobro. Se marcan como 'active' para que no entren
-- al flujo de trial/cobro. La distinción "paying" se hace con stripe_subscription_id.
UPDATE clinics
SET subscription_status = 'active'
WHERE slug IN ('miriamlorenzo', 'symbios-psicologia')
  AND plan = 'starter'
  AND subscription_status = 'free';

-- =============================================================================
-- Fin migración Sprint Comercial Fase 1
-- =============================================================================
